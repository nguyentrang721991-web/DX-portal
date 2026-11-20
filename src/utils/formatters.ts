import * as XLSX from 'xlsx-js-style';
import {
  type DeploymentTask,
  type Product,
  type ProductStatus,
  type StatusHistoryEntry,
  type TaskHealth,
  type TaskStatus,
} from '../types/product.ts';

export function formatMonthLabel(monthStr: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return monthStr;
  const [, year, month] = match;
  return `Tháng ${Number(month)}/${year}`;
}

export function formatMonthShort(monthStr: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return monthStr;
  return `T${Number(match[2])}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    // Handle pure YYYY-MM-DD safely without timezone drift
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return iso;
  }
}

export function toDateInputValue(iso: string): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function getMonthKeyFromIso(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}/.test(iso)) return iso.slice(0, 7);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 7);
}

export function getStatusHistoryMap(history: StatusHistoryEntry[]): Map<ProductStatus, StatusHistoryEntry> {
  const map = new Map<ProductStatus, StatusHistoryEntry>();
  const sorted = [...history].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const entry of sorted) {
    map.set(entry.status, entry);
  }
  return map;
}

export function getTodayLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes Tình trạng (Đúng tiến độ / Chậm) based on end_date vs current date when status !== 'Done'.
 */
export function computeTaskHealth(
  endDate: string,
  status: TaskStatus,
  referenceDateKey = getTodayLocalDateKey()
): { health: TaskHealth; overdueDays: number } {
  if (status === 'Done' || !endDate) {
    return { health: 'Đúng tiến độ', overdueDays: 0 };
  }
  const normalizedEnd = endDate.slice(0, 10);
  if (normalizedEnd < referenceDateKey) {
    const endMs = new Date(`${normalizedEnd}T00:00:00`).getTime();
    const refMs = new Date(`${referenceDateKey}T00:00:00`).getTime();
    const diffDays = Math.max(1, Math.round((refMs - endMs) / (1000 * 60 * 60 * 24)));
    return { health: 'Chậm', overdueDays: diffDays };
  }
  return { health: 'Đúng tiến độ', overdueDays: 0 };
}

export function ensureValidUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function exportProductsToCsv(products: Product[]): void {
  const headers = [
    'Mã SP',
    'Tên sản phẩm',
    'Trạng thái hiện tại',
    'Thời gian cập nhật trạng thái',
    'Nguồn sản phẩm',
    'Đơn vị chủ quản',
    'Đơn vị triển khai',
    'Phạm vi triển khai',
    'Khả năng nhân rộng',
    'Hình thức nhân rộng',
    'Lý do không nhân rộng',
    'Danh sách Link',
  ];

  const escapeCsv = (value: string) => {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const rows = products.map((p) => [
    p.code,
    p.name,
    p.status,
    formatDateTime(p.statusUpdatedAt || p.updatedAt),
    p.source,
    p.governingUnit,
    p.implementingUnit,
    p.deploymentScope,
    p.isReplicable,
    p.replicationMode,
    p.nonReplicableReason || '',
    p.links.map((l) => `${l.title}: ${l.url}`).join(' | '),
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fpt-dx-san-pham-nhan-rong-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDeploymentTasksToCsv(
  tasks: DeploymentTask[],
  productMap: Map<string, Product>
): void {
  const headers = [
    'Mã SP',
    'Sản phẩm',
    'Đầu việc cha',
    'Đầu việc con',
    'PIC',
    'Bên phối hợp',
    'Start_date',
    'End_date',
    'Output',
    'Trạng thái',
    'Tiến độ (%)',
    'Tình trạng',
  ];

  const escapeCsv = (value: string) => {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  };

  const rows = tasks.map((t) => {
    const prod = productMap.get(t.productId);
    const { health } = computeTaskHealth(t.endDate, t.status);
    return [
      prod?.code || '',
      prod?.name || '',
      t.parentTask,
      t.subTask,
      t.pic,
      t.collaborators,
      t.startDate,
      t.endDate,
      t.output,
      t.status,
      `${t.progress}%`,
      health,
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fpt-dx-theo-doi-trien-khai-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ExcelCellStyle = Record<string, unknown>;

const THIN_BORDER_GRAY = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const HEADER_BORDER = {
  top: { style: 'thin', color: { rgb: '004280' } },
  bottom: { style: 'medium', color: { rgb: '003366' } },
  left: { style: 'thin', color: { rgb: '2B74B8' } },
  right: { style: 'thin', color: { rgb: '2B74B8' } },
};

const TITLE_BANNER_STYLE: ExcelCellStyle = {
  font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '005AAB' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const META_LABEL_STYLE: ExcelCellStyle = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '334155' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
  border: THIN_BORDER_GRAY,
  alignment: { horizontal: 'left', vertical: 'center' },
};

const META_VALUE_STYLE: ExcelCellStyle = {
  font: { name: 'Calibri', sz: 10, color: { rgb: '0F172A' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
  border: THIN_BORDER_GRAY,
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
};

function makeHeaderStyle(horizontal: 'left' | 'center' | 'right' = 'left'): ExcelCellStyle {
  return {
    font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '005AAB' } },
    border: HEADER_BORDER,
    alignment: { horizontal, vertical: 'center', wrapText: true },
  };
}

function makeDataStyle(
  isAltRow: boolean,
  horizontal: 'left' | 'center' | 'right' = 'left',
  bold = false
): ExcelCellStyle {
  return {
    font: { name: 'Calibri', sz: 10, bold, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: isAltRow ? 'F8FAFC' : 'FFFFFF' } },
    border: THIN_BORDER_GRAY,
    alignment: { horizontal, vertical: 'center', wrapText: true },
  };
}

function getTaskStatusStyle(status: string): ExcelCellStyle {
  if (status === 'Done') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '166534' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
  if (status === 'In-progress') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '9A3412' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFEDD5' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
  return {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '075985' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E0F2FE' } },
    border: THIN_BORDER_GRAY,
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

function getTaskHealthStyle(health: string): ExcelCellStyle {
  if (health === 'Chậm') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }
  return {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '166534' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } },
    border: THIN_BORDER_GRAY,
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}

function getProductStatusMetaStyle(status: ProductStatus): ExcelCellStyle {
  if (status === 'Đã dừng triển khai') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  if (status === 'Đã golive' || status === 'Theo dõi vận hành') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '166534' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  if (status === 'Đang triển khai') {
    return {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '9A3412' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFEDD5' } },
      border: THIN_BORDER_GRAY,
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  return {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '075985' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E0F2FE' } },
    border: THIN_BORDER_GRAY,
    alignment: { horizontal: 'left', vertical: 'center' },
  };
}

function setCellStyle(ws: XLSX.WorkSheet, row: number, col: number, style: ExcelCellStyle): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const existing = ws[addr] as XLSX.CellObject | undefined;
  if (!existing) {
    ws[addr] = { t: 's', v: '', s: style };
  } else {
    existing.s = style;
  }
}

function sanitizeSheetName(raw: string, usedNames: Set<string>): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, '-').trim() || 'Sheet';
  const base = cleaned.slice(0, 31);
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }
  let counter = 2;
  while (counter < 100) {
    const suffix = `_${counter}`;
    const candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }
  return base;
}

function buildProductProgressSheet(product: Product, productTasks: DeploymentTask[]): XLSX.WorkSheet {
  const sortedTasks = [...productTasks].sort(
    (a, b) => a.parentTask.localeCompare(b.parentTask) || a.startDate.localeCompare(b.startDate)
  );
  const total = sortedTasks.length;
  const doneCount = sortedTasks.filter((t) => t.status === 'Done').length;
  const delayedCount = sortedTasks.filter(
    (t) => computeTaskHealth(t.endDate, t.status).health === 'Chậm'
  ).length;
  const avgProgress =
    total > 0 ? Math.round(sortedTasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;

  const rows: (string | number)[][] = [
    ['BÁO CÁO TIẾN ĐỘ TRIỂN KHAI ĐẦU VIỆC SẢN PHẨM'],
    ['Mã sản phẩm', product.code, '', 'Trạng thái sản phẩm', product.status],
    ['Tên sản phẩm', product.name, '', 'Hình thức nhân rộng', product.replicationMode],
    ['Đơn vị chủ quản', product.governingUnit || '—', '', 'Đơn vị triển khai', product.implementingUnit || '—'],
    [
      'Tổng đầu việc con',
      total,
      '',
      'Hoàn thành (Done)',
      `${doneCount}/${total}`,
    ],
    [
      'Tiến độ trung bình (%)',
      `${avgProgress}%`,
      '',
      'Chậm tiến độ',
      delayedCount,
    ],
    ['Ngày xuất báo cáo', formatDateTime(getTodayLocalDateKey())],
    [],
    [
      'STT',
      'Đầu việc cha',
      'Đầu việc con',
      'PIC',
      'Bên phối hợp',
      'Start_date',
      'End_date',
      'Output',
      'Trạng thái',
      'Tiến độ (%)',
      'Tình trạng',
      'Quá hạn (ngày)',
    ],
  ];

  sortedTasks.forEach((task, idx) => {
    const { health, overdueDays } = computeTaskHealth(task.endDate, task.status);
    rows.push([
      idx + 1,
      task.parentTask,
      task.subTask,
      task.pic || '—',
      task.collaborators || '—',
      formatDateTime(task.startDate),
      formatDateTime(task.endDate),
      task.output || '',
      task.status,
      task.progress,
      health,
      overdueDays > 0 ? overdueDays : 0,
    ]);
  });

  const footerRowIdx = rows.length;
  rows.push([
    '',
    'TỔNG CỘNG / TRUNG BÌNH',
    `${total} đầu việc con`,
    '',
    '',
    '',
    '',
    '',
    `Done: ${doneCount}/${total}`,
    avgProgress,
    delayedCount > 0 ? `${delayedCount} chậm` : 'Đúng tiến độ',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colCount = 12;
  const headerRowIdx = 8;

  ws['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 36 },
    { wch: 18 },
    { wch: 22 },
    { wch: 13 },
    { wch: 13 },
    { wch: 36 },
    { wch: 14 },
    { wch: 13 },
    { wch: 15 },
    { wch: 14 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 28 };
  ws['!rows'][headerRowIdx] = { hpt: 28 };
  ws['!rows'][footerRowIdx] = { hpt: 24 };

  // Title banner
  for (let c = 0; c < colCount; c++) {
    setCellStyle(ws, 0, c, TITLE_BANNER_STYLE);
  }

  // Metadata rows 1..6
  for (let r = 1; r <= 6; r++) {
    setCellStyle(ws, r, 0, META_LABEL_STYLE);
    setCellStyle(ws, r, 1, META_VALUE_STYLE);
    if (r <= 5) {
      setCellStyle(ws, r, 3, META_LABEL_STYLE);
      setCellStyle(ws, r, 4, META_VALUE_STYLE);
    }
  }
  setCellStyle(ws, 1, 4, getProductStatusMetaStyle(product.status));
  setCellStyle(ws, 5, 4, delayedCount > 0 ? getTaskHealthStyle('Chậm') : getTaskHealthStyle('Đúng tiến độ'));

  // Column headers
  const centeredCols = new Set([0, 5, 6, 8, 9, 10, 11]);
  for (let c = 0; c < colCount; c++) {
    setCellStyle(ws, headerRowIdx, c, makeHeaderStyle(centeredCols.has(c) ? 'center' : 'left'));
  }

  // Task rows
  sortedTasks.forEach((task, idx) => {
    const r = headerRowIdx + 1 + idx;
    const isAlt = idx % 2 === 1;
    const { health, overdueDays } = computeTaskHealth(task.endDate, task.status);
    ws['!rows']![r] = { hpt: 22 };

    for (let c = 0; c < colCount; c++) {
      if (c === 8) {
        setCellStyle(ws, r, c, getTaskStatusStyle(task.status));
      } else if (c === 10) {
        setCellStyle(ws, r, c, getTaskHealthStyle(health));
      } else if (c === 11 && overdueDays > 0) {
        setCellStyle(ws, r, c, {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } },
          border: THIN_BORDER_GRAY,
          alignment: { horizontal: 'center', vertical: 'center' },
        });
      } else if (c === 9) {
        setCellStyle(ws, r, c, {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: true,
            color: { rgb: task.progress === 100 ? '166534' : health === 'Chậm' ? 'B91C1C' : '0F172A' },
          },
          fill: { patternType: 'solid', fgColor: { rgb: isAlt ? 'F8FAFC' : 'FFFFFF' } },
          border: THIN_BORDER_GRAY,
          alignment: { horizontal: 'center', vertical: 'center' },
        });
      } else {
        setCellStyle(ws, r, c, makeDataStyle(isAlt, centeredCols.has(c) ? 'center' : 'left'));
      }
    }
  });

  // Footer summary row
  const footerBorder = {
    top: { style: 'medium', color: { rgb: '005AAB' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };
  for (let c = 0; c < colCount; c++) {
    setCellStyle(ws, footerRowIdx, c, {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1E3A8A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
      border: footerBorder,
      alignment: { horizontal: centeredCols.has(c) ? 'center' : 'left', vertical: 'center' },
    });
  }
  setCellStyle(ws, footerRowIdx, 10, {
    ...getTaskHealthStyle(delayedCount > 0 ? 'Chậm' : 'Đúng tiến độ'),
    border: footerBorder,
  });

  return ws;
}

export function exportDeploymentTasksToExcel(
  tasks: DeploymentTask[],
  productMap: Map<string, Product>,
  options?: { singleProduct?: Product }
): void {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  const todayKey = getTodayLocalDateKey();

  if (options?.singleProduct) {
    const product = options.singleProduct;
    const productTasks = tasks.filter((t) => t.productId === product.id);
    const sheetName = sanitizeSheetName(`${product.code} - Tiến độ`, usedSheetNames);
    const ws = buildProductProgressSheet(product, productTasks);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const safeCode = product.code.toLowerCase().replace(/[^a-z0-9-_]/gi, '-');
    XLSX.writeFile(wb, `tien-do-trien-khai-${safeCode}-${todayKey}.xlsx`);
    return;
  }

  // Group tasks by product
  const tasksByProduct = new Map<string, DeploymentTask[]>();
  tasks.forEach((t) => {
    const list = tasksByProduct.get(t.productId) || [];
    list.push(t);
    tasksByProduct.set(t.productId, list);
  });

  const orderedProducts = Array.from(tasksByProduct.keys())
    .map((id) => productMap.get(id))
    .filter((p): p is Product => Boolean(p))
    .sort((a, b) => a.code.localeCompare(b.code));

  // Sheet 1: Summary per product
  const summaryRows: (string | number)[][] = [
    ['TỔNG HỢP TIẾN ĐỘ TRIỂN KHAI THEO TỪNG SẢN PHẨM'],
    ['Ngày xuất báo cáo', formatDateTime(todayKey)],
    [],
    [
      'STT',
      'Mã SP',
      'Tên sản phẩm',
      'Đơn vị chủ quản',
      'Đơn vị triển khai',
      'Hình thức',
      'Tổng đầu việc',
      'Done',
      'In-progress',
      'New',
      'Chậm tiến độ',
      'Tiến độ TB (%)',
    ],
  ];

  const productMetrics: {
    done: number;
    inProgress: number;
    newCount: number;
    delayed: number;
    avg: number;
  }[] = [];

  orderedProducts.forEach((prod, idx) => {
    const pTasks = tasksByProduct.get(prod.id) || [];
    const total = pTasks.length;
    const done = pTasks.filter((t) => t.status === 'Done').length;
    const inProgress = pTasks.filter((t) => t.status === 'In-progress').length;
    const newCount = pTasks.filter((t) => t.status === 'New').length;
    const delayed = pTasks.filter(
      (t) => computeTaskHealth(t.endDate, t.status).health === 'Chậm'
    ).length;
    const avg =
      total > 0 ? Math.round(pTasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;

    productMetrics.push({ done, inProgress, newCount, delayed, avg });
    summaryRows.push([
      idx + 1,
      prod.code,
      prod.name,
      prod.governingUnit || '—',
      prod.implementingUnit || '—',
      prod.replicationMode,
      total,
      done,
      inProgress,
      newCount,
      delayed,
      avg,
    ]);
  });

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  const summaryColCount = 12;
  const summaryHeaderIdx = 3;
  const summaryCenteredCols = new Set([0, 1, 5, 6, 7, 8, 9, 10, 11]);
  summaryWs['!cols'] = [
    { wch: 6 },
    { wch: 11 },
    { wch: 36 },
    { wch: 24 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 15 },
  ];
  summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: summaryColCount - 1 } }];
  summaryWs['!rows'] = [];
  summaryWs['!rows'][0] = { hpt: 28 };
  summaryWs['!rows'][summaryHeaderIdx] = { hpt: 28 };

  for (let c = 0; c < summaryColCount; c++) {
    setCellStyle(summaryWs, 0, c, TITLE_BANNER_STYLE);
    setCellStyle(
      summaryWs,
      summaryHeaderIdx,
      c,
      makeHeaderStyle(summaryCenteredCols.has(c) ? 'center' : 'left')
    );
  }
  setCellStyle(summaryWs, 1, 0, META_LABEL_STYLE);
  setCellStyle(summaryWs, 1, 1, META_VALUE_STYLE);

  productMetrics.forEach((m, idx) => {
    const r = summaryHeaderIdx + 1 + idx;
    const isAlt = idx % 2 === 1;
    summaryWs['!rows']![r] = { hpt: 22 };

    for (let c = 0; c < summaryColCount; c++) {
      if (c === 7 && m.done > 0) {
        setCellStyle(summaryWs, r, c, getTaskStatusStyle('Done'));
      } else if (c === 8 && m.inProgress > 0) {
        setCellStyle(summaryWs, r, c, getTaskStatusStyle('In-progress'));
      } else if (c === 9 && m.newCount > 0) {
        setCellStyle(summaryWs, r, c, getTaskStatusStyle('New'));
      } else if (c === 10) {
        setCellStyle(summaryWs, r, c, getTaskHealthStyle(m.delayed > 0 ? 'Chậm' : 'Đúng tiến độ'));
      } else if (c === 11) {
        setCellStyle(
          summaryWs,
          r,
          c,
          m.avg === 100
            ? getTaskStatusStyle('Done')
            : m.avg > 0
              ? getTaskStatusStyle('In-progress')
              : makeDataStyle(isAlt, 'center', true)
        );
      } else {
        setCellStyle(
          summaryWs,
          r,
          c,
          makeDataStyle(isAlt, summaryCenteredCols.has(c) ? 'center' : 'left', c === 1 || c === 2)
        );
      }
    }
  });

  XLSX.utils.book_append_sheet(
    wb,
    summaryWs,
    sanitizeSheetName('Tổng hợp sản phẩm', usedSheetNames)
  );

  // Sheet 2: Combined flat table across all products
  const allRows: (string | number)[][] = [
    [
      'STT',
      'Mã SP',
      'Tên sản phẩm',
      'Đầu việc cha',
      'Đầu việc con',
      'PIC',
      'Bên phối hợp',
      'Start_date',
      'End_date',
      'Output',
      'Trạng thái',
      'Tiến độ (%)',
      'Tình trạng',
      'Quá hạn (ngày)',
    ],
  ];

  const flatRowMeta: { status: TaskStatus; health: TaskHealth; progress: number; overdueDays: number }[] = [];
  let rowIdx = 1;
  orderedProducts.forEach((prod) => {
    const pTasks = [...(tasksByProduct.get(prod.id) || [])].sort(
      (a, b) => a.parentTask.localeCompare(b.parentTask) || a.startDate.localeCompare(b.startDate)
    );
    pTasks.forEach((task) => {
      const { health, overdueDays } = computeTaskHealth(task.endDate, task.status);
      flatRowMeta.push({ status: task.status, health, progress: task.progress, overdueDays });
      allRows.push([
        rowIdx++,
        prod.code,
        prod.name,
        task.parentTask,
        task.subTask,
        task.pic || '—',
        task.collaborators || '—',
        formatDateTime(task.startDate),
        formatDateTime(task.endDate),
        task.output || '',
        task.status,
        task.progress,
        health,
        overdueDays > 0 ? overdueDays : 0,
      ]);
    });
  });

  const allWs = XLSX.utils.aoa_to_sheet(allRows);
  const allColCount = 14;
  const allCenteredCols = new Set([0, 1, 7, 8, 10, 11, 12, 13]);
  allWs['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 30 },
    { wch: 26 },
    { wch: 34 },
    { wch: 18 },
    { wch: 22 },
    { wch: 13 },
    { wch: 13 },
    { wch: 34 },
    { wch: 14 },
    { wch: 13 },
    { wch: 15 },
    { wch: 14 },
  ];
  allWs['!rows'] = [{ hpt: 28 }];

  for (let c = 0; c < allColCount; c++) {
    setCellStyle(allWs, 0, c, makeHeaderStyle(allCenteredCols.has(c) ? 'center' : 'left'));
  }

  flatRowMeta.forEach((meta, idx) => {
    const r = idx + 1;
    const isAlt = idx % 2 === 1;
    allWs['!rows']![r] = { hpt: 22 };

    for (let c = 0; c < allColCount; c++) {
      if (c === 10) {
        setCellStyle(allWs, r, c, getTaskStatusStyle(meta.status));
      } else if (c === 12) {
        setCellStyle(allWs, r, c, getTaskHealthStyle(meta.health));
      } else if (c === 13 && meta.overdueDays > 0) {
        setCellStyle(allWs, r, c, {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } },
          border: THIN_BORDER_GRAY,
          alignment: { horizontal: 'center', vertical: 'center' },
        });
      } else if (c === 11) {
        setCellStyle(allWs, r, c, {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: true,
            color: { rgb: meta.progress === 100 ? '166534' : meta.health === 'Chậm' ? 'B91C1C' : '0F172A' },
          },
          fill: { patternType: 'solid', fgColor: { rgb: isAlt ? 'F8FAFC' : 'FFFFFF' } },
          border: THIN_BORDER_GRAY,
          alignment: { horizontal: 'center', vertical: 'center' },
        });
      } else {
        setCellStyle(allWs, r, c, makeDataStyle(isAlt, allCenteredCols.has(c) ? 'center' : 'left'));
      }
    }
  });

  XLSX.utils.book_append_sheet(
    wb,
    allWs,
    sanitizeSheetName('Chi tiết đầu việc', usedSheetNames)
  );

  // Per-product dedicated worksheets
  orderedProducts.forEach((prod) => {
    const pTasks = tasksByProduct.get(prod.id) || [];
    const sheetName = sanitizeSheetName(`${prod.code} ${prod.name}`, usedSheetNames);
    const prodWs = buildProductProgressSheet(prod, pTasks);
    XLSX.utils.book_append_sheet(wb, prodWs, sheetName);
  });

  XLSX.writeFile(wb, `fpt-dx-tien-do-trien-khai-${todayKey}.xlsx`);
}
