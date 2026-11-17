import { useMemo, useState } from 'react';
import {
  Search,
  Download,
  ExternalLink,
  Pencil,
  Trash2,
  Eye,
  FilterX,
  Plus,
} from 'lucide-react';
import {
  PRODUCT_STATUSES,
  REPLICATION_MODES,
  REPLICATION_MODE_META,
  STATUS_META,
  type Product,
  type ProductStatus,
  type ReplicabilityOption,
  type ReplicationMode,
} from '../types/product.ts';
import { exportProductsToCsv, formatDateTime } from '../utils/formatters.ts';

interface ProductCatalogViewProps {
  products: Product[];
  initialStatusFilter?: ProductStatus | 'ALL';
  initialModeFilter?: ReplicationMode | 'ALL';
  onSelectProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onAddProduct: () => void;
}

type RecordScope = 'ALL' | 'PUBLISHED' | 'DRAFT';

export function ProductCatalogView({
  products,
  initialStatusFilter = 'ALL',
  initialModeFilter = 'ALL',
  onSelectProduct,
  onEditProduct,
  onDeleteProduct,
  onAddProduct,
}: ProductCatalogViewProps) {
  const [recordScope, setRecordScope] = useState<RecordScope>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'ALL'>(initialStatusFilter);
  const [replicableFilter, setReplicableFilter] = useState<ReplicabilityOption | 'ALL'>('ALL');
  const [modeFilter, setModeFilter] = useState<ReplicationMode | 'ALL'>(initialModeFilter);

  const publishedCount = useMemo(() => products.filter((p) => !p.isDraft).length, [products]);
  const draftCount = useMemo(
    () => products.filter((p) => p.isDraft || Boolean(p.draftData)).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        if (recordScope === 'PUBLISHED' && p.isDraft) return false;
        if (recordScope === 'DRAFT' && !p.isDraft && !p.draftData) return false;
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        if (replicableFilter !== 'ALL' && p.isReplicable !== replicableFilter) return false;
        if (modeFilter !== 'ALL' && p.replicationMode !== modeFilter) return false;

        if (q) {
          const haystack = [
            p.code,
            p.name,
            p.source,
            p.governingUnit,
            p.implementingUnit,
            p.deploymentScope,
            p.nonReplicableReason,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (b.statusUpdatedAt || b.updatedAt).localeCompare(a.statusUpdatedAt || a.updatedAt) ||
          a.code.localeCompare(b.code)
      );
  }, [products, recordScope, searchQuery, statusFilter, replicableFilter, modeFilter]);

  const hasFilters =
    recordScope !== 'ALL' ||
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    replicableFilter !== 'ALL' ||
    modeFilter !== 'ALL';

  const resetFilters = () => {
    setRecordScope('ALL');
    setSearchQuery('');
    setStatusFilter('ALL');
    setReplicableFilter('ALL');
    setModeFilter('ALL');
  };

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Danh mục Sản phẩm Nhân rộng
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Quản lý {publishedCount} sản phẩm chính thức · {draftCount} bản nháp · Hiển thị {filteredProducts.length} kết quả.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setRecordScope('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                recordScope === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setRecordScope('PUBLISHED')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                recordScope === 'PUBLISHED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chính thức ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setRecordScope('DRAFT')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                recordScope === 'DRAFT'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bản nháp ({draftCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => exportProductsToCsv(filteredProducts)}
            disabled={filteredProducts.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất CSV ({filteredProducts.length})</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên sản phẩm, mã SP, nguồn, đơn vị..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProductStatus | 'ALL')}
              aria-label="Lọc theo trạng thái"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Tất cả trạng thái (8)</option>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={replicableFilter}
              onChange={(e) => setReplicableFilter(e.target.value as ReplicabilityOption | 'ALL')}
              aria-label="Lọc theo khả năng nhân rộng"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Khả năng: Tất cả</option>
              <option value="Có">Có thể nhân rộng</option>
              <option value="Không">Không nhân rộng</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as ReplicationMode | 'ALL')}
              aria-label="Lọc theo hình thức nhân rộng"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Hình thức: Tất cả</option>
              {REPLICATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span>Đang áp dụng bộ lọc tìm kiếm</span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-orange-700 hover:text-orange-900 font-medium"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Xóa toàn bộ bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-800">
              Không tìm thấy sản phẩm phù hợp với bộ lọc.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Thử thay đổi từ khóa tìm kiếm hoặc tạo mới một sản phẩm nhân rộng.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Đặt lại bộ lọc
                </button>
              )}
              <button
                type="button"
                onClick={onAddProduct}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm sản phẩm mới</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Mã SP</th>
                  <th className="py-3 px-3 whitespace-nowrap">Tên sản phẩm & Nguồn</th>
                  <th className="py-3 px-3 whitespace-nowrap">Trạng thái & Cập nhật</th>
                  <th className="py-3 px-3 whitespace-nowrap">Đơn vị chủ quản / Triển khai</th>
                  <th className="py-3 px-3 whitespace-nowrap">Phạm vi triển khai</th>
                  <th className="py-3 px-3 whitespace-nowrap">Nhân rộng</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Link</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((product) => {
                  const statusMeta = STATUS_META[product.status];
                  const modeMeta = REPLICATION_MODE_META[product.replicationMode];
                  return (
                    <tr
                      key={product.id}
                      onClick={() => onSelectProduct(product)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 pl-5 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        <div>{product.code}</div>
                        {product.isDraft && (
                          <div className="mt-1 inline-block font-sans text-[11px] font-medium px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800">
                            Bản nháp
                          </div>
                        )}
                        {!product.isDraft && product.draftData && (
                          <div className="mt-1 inline-block font-sans text-[11px] font-medium px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800">
                            Có nháp sửa
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        <div className="font-medium text-slate-900 truncate group-hover:text-[#005AAB] transition-colors">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {product.source || 'Chưa cập nhật nguồn'}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className={`text-xs font-medium ${statusMeta.textClass}`}>
                          {product.status}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                          Cập nhật: {formatDateTime(product.statusUpdatedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="text-xs font-medium text-slate-800 truncate">
                          {product.governingUnit || 'Chưa cập nhật'}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          Triển khai: {product.implementingUnit || 'Chưa cập nhật'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-[200px] truncate">
                        {product.deploymentScope || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium ${
                              product.isReplicable === 'Có' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {product.isReplicable}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded border ${modeMeta.bgTint} ${modeMeta.textClass}`}
                          >
                            {product.replicationMode}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {product.links.length}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </span>
                      </td>
                      <td
                        className="py-3 pl-3 pr-5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-[#005AAB] hover:bg-sky-50 rounded-md transition-colors"
                            title="Xem chi tiết"
                            aria-label={`Xem chi tiết ${product.name}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                            title="Chỉnh sửa"
                            aria-label={`Chỉnh sửa ${product.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(product)}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            title="Xóa sản phẩm"
                            aria-label={`Xóa ${product.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
