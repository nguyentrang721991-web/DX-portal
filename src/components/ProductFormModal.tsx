import { useEffect, useState } from 'react';
import { FileEdit, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import {
  FPT_UNIT_SUGGESTIONS,
  PRODUCT_STATUSES,
  REPLICATION_MODES,
  REPLICATION_MODE_META,
  type Product,
  type ProductFormData,
  type ProductLink,
  type ProductStatus,
  type ReplicabilityOption,
  type ReplicationMode,
  type SaveMode,
  type StatusHistoryEntry,
} from '../types/product.ts';
import { ensureValidUrl, formatDateTime, toDateInputValue } from '../utils/formatters.ts';

interface ProductFormModalProps {
  open: boolean;
  editingProduct: Product | null;
  onClose: () => void;
  onSubmit: (data: ProductFormData, saveMode: SaveMode) => Promise<void>;
  onDiscardDraft?: (productId: string) => Promise<void>;
}

export function ProductFormModal({
  open,
  editingProduct,
  onClose,
  onSubmit,
  onDiscardDraft,
}: ProductFormModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProductStatus>('Đánh giá sơ bộ');
  const [statusDate, setStatusDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stageDates, setStageDates] = useState<Partial<Record<ProductStatus, string>>>({});
  const [showTimelineDates, setShowTimelineDates] = useState(false);

  const [source, setSource] = useState('');
  const [governingUnit, setGoverningUnit] = useState('');
  const [implementingUnit, setImplementingUnit] = useState('');
  const [deploymentScope, setDeploymentScope] = useState('');
  const [isReplicable, setIsReplicable] = useState<ReplicabilityOption>('Có');
  const [replicationMode, setReplicationMode] = useState<ReplicationMode>('GO-P');
  const [nonReplicableReason, setNonReplicableReason] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<ProductLink[]>([]);
  const [error, setError] = useState('');
  const [submittingMode, setSubmittingMode] = useState<SaveMode | null>(null);
  const [loadedFromPendingDraft, setLoadedFromPendingDraft] = useState(false);

  const populateFields = (sourceData: ProductFormData) => {
    setCode(sourceData.code);
    setName(sourceData.name);
    setStatus(sourceData.status);
    setStatusDate(toDateInputValue(sourceData.statusUpdatedAt));

    const map: Partial<Record<ProductStatus, string>> = {};
    (sourceData.statusHistory || []).forEach((h) => {
      map[h.status] = toDateInputValue(h.updatedAt);
    });
    setStageDates(map);
    setShowTimelineDates(false);

    setSource(sourceData.source);
    setGoverningUnit(sourceData.governingUnit);
    setImplementingUnit(sourceData.implementingUnit);
    setDeploymentScope(sourceData.deploymentScope);
    setIsReplicable(sourceData.isReplicable);
    setReplicationMode(sourceData.replicationMode);
    setNonReplicableReason(sourceData.nonReplicableReason);
    setDescription(sourceData.description || '');
    setLinks(
      sourceData.links.length > 0
        ? sourceData.links
        : [{ id: `l-${Date.now()}`, title: '', url: '', category: 'Tài liệu' }]
    );
  };

  useEffect(() => {
    if (!open) return;
    if (editingProduct) {
      if (editingProduct.draftData) {
        populateFields(editingProduct.draftData);
        setLoadedFromPendingDraft(true);
      } else {
        populateFields(editingProduct);
        setLoadedFromPendingDraft(false);
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setCode('');
      setName('');
      setStatus('Đánh giá sơ bộ');
      setStatusDate(today);
      setStageDates({ 'Đánh giá sơ bộ': today });
      setShowTimelineDates(false);

      setSource('');
      setGoverningUnit('');
      setImplementingUnit('');
      setDeploymentScope('');
      setIsReplicable('Có');
      setReplicationMode('GO-P');
      setNonReplicableReason('');
      setDescription('');
      setLinks([{ id: `l-${Date.now()}`, title: '', url: '', category: 'Tài liệu' }]);
      setLoadedFromPendingDraft(false);
    }
    setError('');
  }, [open, editingProduct]);

  if (!open) return null;

  const handleStatusSelect = (nextStatus: ProductStatus) => {
    setStatus(nextStatus);
    if (stageDates[nextStatus]) {
      setStatusDate(stageDates[nextStatus]!);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setStatusDate(today);
      setStageDates((prev) => ({ ...prev, [nextStatus]: today }));
    }
  };

  const handleStatusDateChange = (val: string) => {
    setStatusDate(val);
    setStageDates((prev) => ({ ...prev, [status]: val }));
  };

  const handleReplicableChange = (val: ReplicabilityOption) => {
    setIsReplicable(val);
    if (val === 'Không') {
      setReplicationMode('NO-GO');
    } else if (replicationMode === 'NO-GO') {
      setReplicationMode('GO-P');
    }
  };

  const handleModeChange = (mode: ReplicationMode) => {
    setReplicationMode(mode);
    if (mode === 'NO-GO') {
      setIsReplicable('Không');
    } else {
      setIsReplicable('Có');
    }
  };

  const addLinkRow = () => {
    setLinks((prev) => [
      ...prev,
      { id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: '', url: '', category: 'Tài liệu' },
    ]);
  };

  const updateLinkRow = (id: string, field: keyof ProductLink, value: string) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLinkRow = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const buildFormPayload = (): ProductFormData => {
    const effectiveDate = statusDate || new Date().toISOString().slice(0, 10);
    const statusUpdatedAtIso = `${effectiveDate}T09:00:00.000Z`;

    const mergedMap: Partial<Record<ProductStatus, string>> = {
      ...stageDates,
      [status]: effectiveDate,
    };

    const statusHistory: StatusHistoryEntry[] = PRODUCT_STATUSES.filter((s) =>
      Boolean(mergedMap[s])
    ).map((s, idx) => ({
      id: `sh-${Date.now()}-${idx}`,
      status: s,
      updatedAt: `${mergedMap[s]}T09:00:00.000Z`,
    }));

    const cleanedLinks: ProductLink[] = links
      .filter((l) => l.url.trim().length > 0)
      .map((l) => {
        const normalizedUrl = ensureValidUrl(l.url);
        return {
          id: l.id,
          title: l.title.trim() || normalizedUrl,
          url: normalizedUrl,
          category: l.category?.trim() || 'Liên kết',
        };
      });

    return {
      code: code.trim(),
      name: name.trim(),
      status,
      statusUpdatedAt: statusUpdatedAtIso,
      statusHistory,
      source: source.trim(),
      governingUnit: governingUnit.trim(),
      implementingUnit: implementingUnit.trim(),
      deploymentScope: deploymentScope.trim(),
      isReplicable,
      replicationMode,
      nonReplicableReason: nonReplicableReason.trim(),
      description: description.trim(),
      links: cleanedLinks,
    };
  };

  const handleSave = async (mode: 'draft' | 'publish') => {
    setError('');

    if (mode === 'publish') {
      if (!name.trim()) {
        setError('Vui lòng nhập Tên sản phẩm trước khi lưu chính thức.');
        return;
      }
      if (!source.trim() || !governingUnit.trim() || !implementingUnit.trim()) {
        setError(
          'Vui lòng điền đầy đủ Nguồn sản phẩm, Đơn vị chủ quản và Đơn vị triển khai (hoặc chọn Lưu nháp để bổ sung sau).'
        );
        return;
      }
      if ((isReplicable === 'Không' || replicationMode === 'NO-GO') && !nonReplicableReason.trim()) {
        setError('Vui lòng nhập Lý do không nhân rộng khi chọn Không / NO-GO.');
        return;
      }
    }

    setSubmittingMode(mode);
    try {
      await onSubmit(buildFormPayload(), mode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu thông tin sản phẩm.');
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave('publish');
  };

  const handleRestoreOfficial = () => {
    if (!editingProduct) return;
    populateFields(editingProduct);
    setLoadedFromPendingDraft(false);
    setError('');
  };

  const handleDiscardPendingDraft = async () => {
    if (!editingProduct || !onDiscardDraft) return;
    setSubmittingMode('discard-draft');
    try {
      await onDiscardDraft(editingProduct.id);
      populateFields(editingProduct);
      setLoadedFromPendingDraft(false);
    } finally {
      setSubmittingMode(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="product-form-title" className="font-display text-lg font-bold text-slate-900">
              {editingProduct ? `Chỉnh sửa: ${editingProduct.name}` : 'Thêm sản phẩm nhân rộng mới'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bạn có thể Lưu nháp bất kỳ lúc nào để tiếp tục bổ sung sau, hoặc Lưu chính thức khi hoàn thiện.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} noValidate className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Draft status banners */}
          {editingProduct?.isDraft && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Bản ghi này đang ở trạng thái <strong>Lưu nháp</strong> (chưa tính vào Dashboard chính thức).
                </span>
              </div>
            </div>
          )}

          {loadedFromPendingDraft && editingProduct?.draftData && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Đang tải nội dung từ <strong>bản nháp cập nhật</strong>
                  {editingProduct.draftUpdatedAt
                    ? ` (lưu ngày ${formatDateTime(editingProduct.draftUpdatedAt)})`
                    : ''}
                  .
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreOfficial}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-300 rounded text-amber-900 hover:bg-amber-100 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xem bản chính thức</span>
                </button>
                {onDiscardDraft && (
                  <button
                    type="button"
                    disabled={submittingMode !== null}
                    onClick={handleDiscardPendingDraft}
                    className="px-2.5 py-1 bg-white border border-red-200 rounded text-red-700 hover:bg-red-50 font-medium"
                  >
                    Xóa bản nháp
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Section 1: Core Identity & Status Timestamp */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500">
              1. Thông tin cơ bản & Thời gian cập nhật trạng thái
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mã sản phẩm
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Tự động (DX-xxx)"
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="sm:col-span-9">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tên sản phẩm <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: FPT.AI eKYC & Định danh Số"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Trạng thái hiện tại <span className="text-red-600">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusSelect(e.target.value as ProductStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {PRODUCT_STATUSES.map((s, idx) => (
                    <option key={s} value={s}>
                      0{idx + 1}. {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ngày cập nhật trạng thái
                </label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => handleStatusDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  Mốc thời gian các trạng thái trong vòng đời
                </span>
                <button
                  type="button"
                  onClick={() => setShowTimelineDates((v) => !v)}
                  className="text-xs font-medium text-[#005AAB] hover:underline"
                >
                  {showTimelineDates ? 'Thu gọn' : 'Chỉnh sửa chi tiết các mốc'}
                </button>
              </div>

              {showTimelineDates && (
                <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRODUCT_STATUSES.map((s, idx) => (
                    <div
                      key={s}
                      className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="text-xs text-slate-700 truncate">
                        0{idx + 1}. {s}
                      </span>
                      <input
                        type="date"
                        value={stageDates[s] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStageDates((prev) => {
                            const next = { ...prev };
                            if (val) next[s] = val;
                            else delete next[s];
                            return next;
                          });
                          if (s === status && val) {
                            setStatusDate(val);
                          }
                        }}
                        className="text-xs font-mono text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mô tả tóm tắt giải pháp
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả giá trị cốt lõi, bài toán nghiệp vụ được giải quyết..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Section 2: Units & Scope */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500">
              2. Nguồn gốc, Đơn vị & Phạm vi triển khai
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nguồn sản phẩm <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Nhập nguồn sản phẩm..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Đơn vị chủ quản <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  list="fpt-unit-suggestions"
                  value={governingUnit}
                  onChange={(e) => setGoverningUnit(e.target.value)}
                  placeholder="VD: FPT IS"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Đơn vị triển khai <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  list="fpt-unit-suggestions"
                  value={implementingUnit}
                  onChange={(e) => setImplementingUnit(e.target.value)}
                  placeholder="VD: FPT Retail (Long Châu)"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <datalist id="fpt-unit-suggestions">
                {FPT_UNIT_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phạm vi triển khai
              </label>
              <input
                type="text"
                value={deploymentScope}
                onChange={(e) => setDeploymentScope(e.target.value)}
                placeholder="VD: Toàn bộ 8 CTTV Tập đoàn FPT hoặc Hệ thống 1.800+ nhà thuốc Long Châu"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Section 3: Replicability & Strategy */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <h3 className="text-xs font-semibold text-slate-500">
              3. Đánh giá Khả năng & Hình thức nhân rộng
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Khả năng nhân rộng
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  {(['Có', 'Không'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleReplicableChange(opt)}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        isReplicable === opt
                          ? opt === 'Có'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-8">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Hình thức nhân rộng
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {REPLICATION_MODES.map((mode) => {
                    const active = replicationMode === mode;
                    const meta = REPLICATION_MODE_META[mode];
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleModeChange(mode)}
                        className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                          active
                            ? 'border-[#F37021] bg-orange-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold">{mode}</div>
                        <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{meta.shortLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lý do không nhân rộng{' '}
                {(isReplicable === 'Không' || replicationMode === 'NO-GO') && (
                  <span className="text-red-600">* (Bắt buộc khi chọn Không / NO-GO)</span>
                )}
              </label>
              <textarea
                rows={2}
                value={nonReplicableReason}
                onChange={(e) => setNonReplicableReason(e.target.value)}
                placeholder={
                  isReplicable === 'Không'
                    ? 'Nêu rõ lý do kỹ thuật, chi phí ROI hoặc trùng lặp nền tảng...'
                    : 'Chỉ điền nếu sản phẩm không nhân rộng (NO-GO) hoặc có lưu ý giới hạn...'
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Section 4: Multiple Product Links */}
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-500">
                  4. Link sản phẩm (cho phép gắn nhiều link)
                </h3>
              </div>
              <button
                type="button"
                onClick={addLinkRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#005AAB] hover:bg-sky-50 border border-sky-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm dòng link</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => updateLinkRow(link.id, 'title', e.target.value)}
                      placeholder={`Tên link #${index + 1} (VD: Tài liệu Confluence)`}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => updateLinkRow(link.id, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={link.category || ''}
                      onChange={(e) => updateLinkRow(link.id, 'category', e.target.value)}
                      placeholder="Loại"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLinkRow(link.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                      title="Xóa dòng link"
                      aria-label={`Xóa dòng link ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {links.length === 0 && (
                <p className="text-xs text-slate-400">
                  Chưa có dòng link nào. Nhấn &ldquo;Thêm dòng link&rdquo; để gắn liên kết.
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submittingMode !== null}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              Hủy
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={submittingMode !== null}
                onClick={() => handleSave('draft')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{submittingMode === 'draft' ? 'Đang lưu nháp...' : 'Lưu nháp'}</span>
              </button>

              <button
                type="submit"
                disabled={submittingMode !== null}
                className="px-5 py-2 text-sm font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {submittingMode === 'publish'
                  ? 'Đang lưu...'
                  : editingProduct
                    ? editingProduct.isDraft
                      ? 'Hoàn tất & Lưu chính thức'
                      : 'Cập nhật chính thức'
                    : 'Lưu chính thức'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
