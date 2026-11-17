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
