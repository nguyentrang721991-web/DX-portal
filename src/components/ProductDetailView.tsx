import AssessmentWorkspace from './assessment/AssessmentWorkspace';
import { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileEdit,
  FileSpreadsheet,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  PRODUCT_STATUSES,
  REPLICATION_MODE_META,
  STATUS_META,
  type DeploymentTask,
  type Product,
  type ProductLink,
  type ProductStatus,
  type StatusHistoryEntry,
} from '../types/product.ts';
import {
  ensureValidUrl,
  exportDeploymentTasksToExcel,
  formatDateTime,
  formatMonthShort,
  getMonthKeyFromIso,
  getStatusHistoryMap,
  toDateInputValue,
} from '../utils/formatters.ts';

interface ProductDetailViewProps {
  product: Product;
  deploymentTasks?: DeploymentTask[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onDiscardDraft: (productId: string) => Promise<void>;
  onQuickUpdateStatus: (productId: string, status: ProductStatus) => Promise<void>;
  onQuickUpdateStatusHistory: (
    productId: string,
    statusHistory: StatusHistoryEntry[],
    latestUpdatedAt?: string
  ) => Promise<void>;
  onQuickUpdateLinks: (productId: string, links: ProductLink[]) => Promise<void>;
}

export function ProductDetailView({
  product,
  deploymentTasks = [],
  onEdit,
  onDelete,
  onDiscardDraft,
  onQuickUpdateStatus,
  onQuickUpdateStatusHistory,
  onQuickUpdateLinks,
}: ProductDetailViewProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingStageDate, setEditingStageDate] = useState<ProductStatus | null>(null);
  const [stageDateDraft, setStageDateDraft] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState('Tài liệu');
  const [savingLink, setSavingLink] = useState(false);

  const currentStep = STATUS_META[product.status].step;
  const modeMeta = REPLICATION_MODE_META[product.replicationMode];

  const historyMap = useMemo(
    () => getStatusHistoryMap(product.statusHistory || []),
    [product.statusHistory]
  );

  const handleStatusChange = async (nextStatus: ProductStatus) => {
    if (nextStatus === product.status || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await onQuickUpdateStatus(product.id, nextStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openEditStageDate = (status: ProductStatus) => {
    const existing = historyMap.get(status);
    setStageDateDraft(existing ? toDateInputValue(existing.updatedAt) : toDateInputValue(''));
    setEditingStageDate(status);
  };

  const saveStageDate = async (status: ProductStatus) => {
    if (!stageDateDraft) return;
    setUpdatingStatus(true);
    try {
      const isoDate = `${stageDateDraft}T09:00:00.000Z`;
      const existingList = [...(product.statusHistory || [])];
      const idx = existingList.findIndex((h) => h.status === status);
      if (idx >= 0) {
        existingList[idx] = { ...existingList[idx], updatedAt: isoDate };
      } else {
        existingList.push({
          id: `sh-${Date.now()}`,
          status,
          updatedAt: isoDate,
        });
      }
      const nextLatest = status === product.status ? isoDate : product.statusUpdatedAt;
      await onQuickUpdateStatusHistory(product.id, existingList, nextLatest);
      setEditingStageDate(null);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyUrl = async (link: ProductLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId(null), 1800);
    } catch {
      // Clipboard API fallback ignored cleanly
    }
  };

  const handleAddInlineLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrl = ensureValidUrl(newLinkUrl);
    if (!validUrl) return;
    setSavingLink(true);
    try {
      const nextLink: ProductLink = {
        id: `l-${Date.now()}`,
        title: newLinkTitle.trim() || validUrl,
        url: validUrl,
        category: newLinkCategory.trim() || 'Liên kết',
      };
      await onQuickUpdateLinks(product.id, [...product.links, nextLink]);
      setNewLinkTitle('');
      setNewLinkUrl('');
      setShowAddLink(false);
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    const nextLinks = product.links.filter((l) => l.id !== linkId);
    await onQuickUpdateLinks(product.id, nextLinks);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Draft Banner if applicable */}
      {product.isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-amber-950">
            <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Bản ghi này đang được lưu ở trạng thái <strong>Bản nháp</strong> (chưa tính vào Dashboard chính thức).
            </span>
          </div>
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Hoàn tất & Lưu chính thức
          </button>
        </div>
      )}

      {!product.isDraft && product.draftData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-amber-950">
            <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Sản phẩm đang có <strong>bản nháp chỉnh sửa</strong> chưa phát hành
              {product.draftUpdatedAt ? ` (lưu ngày ${formatDateTime(product.draftUpdatedAt)})` : ''}.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDiscardDraft(product.id)}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Hủy bản nháp
            </button>
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors whitespace-nowrap"
            >
              Tiếp tục chỉnh sửa bản nháp
            </button>
          </div>
        </div>
      )}

      {/* Top Product Identity & Actions */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">{product.code}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Cập nhật trạng thái: {formatDateTime(product.statusUpdatedAt || product.updatedAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {(product.statusHistory || []).length} mốc thời gian đã ghi nhận
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {product.name}
            </h1>
            {product.description && (
              <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {deploymentTasks.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const map = new Map<string, Product>([[product.id, product]]);
                  exportDeploymentTasksToExcel(deploymentTasks, map, { singleProduct: product });
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Xuất Excel tiến độ ({deploymentTasks.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
              <span>Chỉnh sửa</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa</span>
            </button>
          </div>
        </div>

        {/* Lifecycle Pipeline */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Vòng đời trạng thái sản phẩm (
                {product.status === 'Đã dừng triển khai'
                  ? 'Đã dừng triển khai'
                  : `Bước ${currentStep}/8`}
                )
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhấp vào từng trạng thái để chuyển bước hiện tại, hoặc nhấn biểu tượng lịch để chỉnh ngày cập nhật của mốc đó.
              </p>
            </div>
            <div className="shrink-0">
              <select
                value={product.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as ProductStatus)}
                aria-label="Chọn trạng thái sản phẩm"
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRODUCT_STATUSES.map((status, idx) => {
              const stepNum = idx + 1;
              const isStoppedCard = status === 'Đã dừng triển khai';
              const isStoppedProduct = product.status === 'Đã dừng triển khai';
              const isCurrent = product.status === status;
              const isCompleted = !isStoppedProduct && !isStoppedCard && stepNum < currentStep;
              const historyEntry = historyMap.get(status);
              const isEditingThisDate = editingStageDate === status;

              return (
                <div
                  key={status}
                  className={`rounded-lg border p-3 transition-colors flex flex-col justify-between ${
                    isCurrent && isStoppedCard
                      ? 'bg-red-50 border-red-500 text-slate-900'
                      : isCurrent
                        ? 'bg-orange-50 border-[#F37021] text-slate-900'
                        : isCompleted || historyEntry
                          ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                          : isStoppedCard
                            ? 'bg-slate-50/70 border-slate-200 text-slate-500 hover:border-red-200'
                            : 'bg-slate-50/70 border-slate-200 text-slate-500'
                  }`}
                >
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(status)}
                    className="text-left w-full focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          isCurrent && isStoppedCard
                            ? 'text-red-700'
                            : isCurrent
                              ? 'text-[#F37021]'
                              : isCompleted || historyEntry
                                ? 'text-emerald-700'
                                : 'text-slate-400'
                        }`}
                      >
                        {String(stepNum).padStart(2, '0')}
                        {historyEntry
                          ? ` · ${formatMonthShort(getMonthKeyFromIso(historyEntry.updatedAt))}/${historyEntry.updatedAt.slice(0, 4)}`
                          : ''}
                      </span>
                      {(isCompleted || isCurrent) && (
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isCurrent && isStoppedCard
                              ? 'text-red-600'
                              : isCurrent
                                ? 'text-[#F37021]'
                                : 'text-emerald-600'
                          }`}
                        />
                      )}
                    </div>
                    <div
                      className={`text-xs font-semibold leading-snug ${
                        isCurrent && isStoppedCard ? 'text-red-800' : ''
                      }`}
                    >
                      {status}
                    </div>
                  </button>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    {isEditingThisDate ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="date"
                          value={stageDateDraft}
                          onChange={(e) => setStageDateDraft(e.target.value)}
                          className="flex-1 min-w-0 px-1.5 py-1 text-[11px] font-mono bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => saveStageDate(status)}
                          disabled={updatingStatus}
                          className="px-2 py-1 text-[11px] font-medium text-white bg-[#F37021] rounded hover:bg-[#D95B10]"
                        >
                          Lưu
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {historyEntry ? formatDateTime(historyEntry.updatedAt) : 'Chưa cập nhật'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditStageDate(status)}
                          title="Chỉnh sửa ngày cập nhật mốc trạng thái"
                          aria-label={`Chỉnh ngày cập nhật cho ${status}`}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white/80 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main 2-Column Content: Governance Metadata & Replication Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900 pb-4 border-b border-slate-100">
            Thông tin Nguồn gốc & Đơn vị Triển khai
          </h2>

          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <dt className="text-slate-500 font-medium">Nguồn sản phẩm</dt>
              <dd className="sm:col-span-2 text-slate-900 font-medium">
                {product.source || 'Chưa cập nhật'}
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <dt className="text-slate-500 font-medium">Đơn vị chủ quản</dt>
              <dd className="sm:col-span-2 text-slate-900 font-medium">
                {product.governingUnit || 'Chưa cập nhật'}
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <dt className="text-slate-500 font-medium">Đơn vị triển khai</dt>
              <dd className="sm:col-span-2 text-slate-900 font-medium">
                {product.implementingUnit || 'Chưa cập nhật'}
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <dt className="text-slate-500 font-medium">Phạm vi triển khai</dt>
              <dd className="sm:col-span-2 text-slate-800 leading-relaxed">
                {product.deploymentScope || 'Chưa xác định phạm vi triển khai'}
              </dd>
            </div>

            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <dt className="text-slate-500 font-medium">Thời gian cập nhật trạng thái</dt>
              <dd className="sm:col-span-2 font-mono text-slate-900 tabular-nums">
                {formatDateTime(product.statusUpdatedAt || product.updatedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 pb-4 border-b border-slate-100">
              Đánh giá Khả năng & Hình thức Nhân rộng
            </h2>

            <div className="mt-4 space-y-5">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-500">Khả năng nhân rộng</span>
                <span
                  className={`text-sm font-semibold ${
                    product.isReplicable === 'Có' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {product.isReplicable === 'Có' ? 'Có — Đủ điều kiện nhân rộng' : 'Không nhân rộng'}
                </span>
              </div>

              <div>
                <div className="text-sm font-medium text-slate-500 mb-2">Hình thức nhân rộng</div>
                <div className={`p-3.5 rounded-lg border ${modeMeta.bgTint}`}>
                  <div className={`font-mono text-sm font-bold ${modeMeta.textClass}`}>
                    {modeMeta.label}
                  </div>
                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                    {modeMeta.description}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-slate-500 mb-2">Lý do không nhân rộng</div>
                {product.isReplicable === 'Không' ||
                product.replicationMode === 'NO-GO' ||
                product.nonReplicableReason ? (
                  <div className="p-3.5 rounded-lg border border-red-200 bg-red-50/60 text-sm text-red-950 leading-relaxed">
                    {product.nonReplicableReason ||
                      'Chưa nhập lý do cụ thể cho quyết định không nhân rộng.'}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500">
                    Sản phẩm đủ điều kiện nhân rộng (GO), không áp dụng lý do dừng nhân rộng.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Multi-Link Manager Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Link sản phẩm & Tài liệu đính kèm ({product.links.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cho phép gắn nhiều liên kết (Portal, Confluence, Demo, Hồ sơ phê duyệt, Kho mã nguồn).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddLink((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm liên kết</span>
          </button>
        </div>

        {showAddLink && (
          <form
            onSubmit={handleAddInlineLink}
            className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tên hiển thị liên kết
                </label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="VD: Tài liệu kiến trúc Confluence"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Đường dẫn URL <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Phân loại</label>
                <input
                  type="text"
                  value={newLinkCategory}
                  onChange={(e) => setNewLinkCategory(e.target.value)}
                  placeholder="Tài liệu / Portal / Demo"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddLink(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingLink}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors disabled:opacity-50"
              >
                {savingLink ? 'Đang lưu...' : 'Lưu liên kết'}
              </button>
            </div>
          </form>
        )}

        {product.links.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Chưa có liên kết nào được gắn cho sản phẩm này. Nhấn &ldquo;Thêm liên kết&rdquo; để bổ sung.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {product.links.map((link) => (
              <div
                key={link.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600 shrink-0 mt-0.5">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[#005AAB] hover:underline truncate"
                      >
                        {link.title}
                      </a>
                      {link.category && (
                        <span className="text-xs text-slate-400">· {link.category}</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-500 truncate mt-0.5">
                      {link.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(link)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedLinkId === link.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#005AAB] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Mở link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Gỡ liên kết"
                    aria-label={`Gỡ liên kết ${link.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
