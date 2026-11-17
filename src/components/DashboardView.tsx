import { useMemo, useState } from 'react';
import { ArrowUpRight, FilterX, ExternalLink } from 'lucide-react';
import {
  PRODUCT_STATUSES,
  REPLICATION_MODES,
  REPLICATION_MODE_META,
  STATUS_META,
  type Product,
  type ProductStatus,
  type ReplicationMode,
} from '../types/product.ts';
import { formatDateTime } from '../utils/formatters.ts';

interface DashboardViewProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onNavigateCatalog: (preset?: {
    status?: ProductStatus | 'ALL';
    mode?: ReplicationMode | 'ALL';
  }) => void;
}

export function DashboardView({
  products,
  onSelectProduct,
  onNavigateCatalog,
}: DashboardViewProps) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<ProductStatus | null>(null);
  const [activeModeFilter, setActiveModeFilter] = useState<ReplicationMode | null>(null);

  const officialProducts = useMemo(
    () => products.filter((p) => !p.isDraft),
    [products]
  );

  // 1. KPI Computations
  const totalCount = officialProducts.length;
  const goliveAndOpsCount = officialProducts.filter(
    (p) => p.status === 'Đã golive' || p.status === 'Theo dõi vận hành'
  ).length;
  const executingAndPlanCount = officialProducts.filter(
    (p) =>
      p.status === 'Đang triển khai' ||
      p.status === 'Đang lên kế hoạch chi tiết' ||
      p.status === 'Đã được duyệt chủ trương'
  ).length;
  const replicableCount = officialProducts.filter((p) => p.isReplicable === 'Có').length;
  const nonReplicableCount = totalCount - replicableCount;
  const replicablePct = totalCount > 0 ? Math.round((replicableCount / totalCount) * 100) : 0;

  // 2. Status Distribution (8 statuses)
  const statusStats = useMemo(() => {
    const counts = new Map<ProductStatus, number>();
    PRODUCT_STATUSES.forEach((s) => counts.set(s, 0));
    officialProducts.forEach((p) => {
      counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    });
    const maxCount = Math.max(1, ...Array.from(counts.values()));
    return PRODUCT_STATUSES.map((status) => {
      const count = counts.get(status) ?? 0;
      return {
        status,
        count,
        pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        barWidthPct: Math.round((count / maxCount) * 100),
        meta: STATUS_META[status],
      };
    });
  }, [officialProducts, totalCount]);

  // 3. Replication Mode Distribution
  const modeStats = useMemo(() => {
    return REPLICATION_MODES.map((mode) => {
      const count = officialProducts.filter((p) => p.replicationMode === mode).length;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return {
        mode,
        count,
        pct,
        meta: REPLICATION_MODE_META[mode],
      };
    });
  }, [officialProducts, totalCount]);

  // 4. Filtered Spotlight Table
  const tableProducts = useMemo(() => {
    let list = officialProducts;
    if (activeStatusFilter) {
      list = list.filter((p) => p.status === activeStatusFilter);
    }
    if (activeModeFilter) {
      list = list.filter((p) => p.replicationMode === activeModeFilter);
    }
    return [...list].sort((a, b) =>
      (b.statusUpdatedAt || b.updatedAt).localeCompare(a.statusUpdatedAt || a.updatedAt)
    );
  }, [officialProducts, activeStatusFilter, activeModeFilter]);

  const hasActiveFilter = Boolean(activeStatusFilter || activeModeFilter);

  const clearFilters = () => {
    setActiveStatusFilter(null);
    setActiveModeFilter(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Dashboard Tổng hợp Sản phẩm Nhân rộng
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi tổng quan số lượng sản phẩm chuyển đổi số FPT theo từng trạng thái vòng đời và hình thức nhân rộng.
        </p>
      </div>

      {/* KPI Strip (4 Columns) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Chỉ số tổng hợp">
        <button
          type="button"
          onClick={clearFilters}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <div className="text-xs font-medium text-slate-500">Tổng số sản phẩm</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-slate-900 tabular-nums">
              {totalCount}
            </span>
            <span className="text-xs text-slate-500">Danh mục FPT DX</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {replicableCount} Có thể nhân rộng · {nonReplicableCount} Không nhân rộng
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            clearFilters();
            setActiveStatusFilter('Theo dõi vận hành');
          }}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <div className="text-xs font-medium text-slate-500">Đã Golive & Vận hành</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-emerald-700 tabular-nums">
              {goliveAndOpsCount}
            </span>
            <span className="font-mono text-xs font-medium text-emerald-700 tabular-nums">
              {totalCount > 0 ? Math.round((goliveAndOpsCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {officialProducts.filter((p) => p.status === 'Đã golive').length} Đã golive ·{' '}
            {officialProducts.filter((p) => p.status === 'Theo dõi vận hành').length} Theo dõi vận hành
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            clearFilters();
            setActiveStatusFilter('Đang triển khai');
          }}
          className="text-left bg-white border border-slate-200 hover:border-orange-300 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <div className="text-xs font-medium text-slate-500">Đang triển khai & Kế hoạch</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-[#F37021] tabular-nums">
              {executingAndPlanCount}
            </span>
            <span className="font-mono text-xs font-medium text-orange-700 tabular-nums">
              {totalCount > 0 ? Math.round((executingAndPlanCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            {officialProducts.filter((p) => p.status === 'Đang triển khai').length} Đang triển khai ·{' '}
            {officialProducts.filter((p) => p.status === 'Đang lên kế hoạch chi tiết').length} Lên kế hoạch
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            clearFilters();
            setActiveModeFilter('GO-P');
          }}
          className="text-left bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <div className="text-xs font-medium text-slate-500">Tỷ lệ nhân rộng (GO)</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-[#005AAB] tabular-nums">
              {replicablePct}%
            </span>
            <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
              {replicableCount}/{totalCount} SP
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            GO-P: {officialProducts.filter((p) => p.replicationMode === 'GO-P').length} · GO-C:{' '}
            {officialProducts.filter((p) => p.replicationMode === 'GO-C').length} · GO-M:{' '}
            {officialProducts.filter((p) => p.replicationMode === 'GO-M').length}
          </div>
        </button>
      </section>

      {/* Primary Charts Grid: Status Distribution + Replication Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Số lượng sản phẩm theo từng trạng thái
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhấp vào một trạng thái để lọc danh sách sản phẩm bên dưới.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateCatalog({ status: activeStatusFilter ?? 'ALL' })}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#005AAB] hover:text-blue-900 whitespace-nowrap shrink-0"
            >
              <span>Mở danh mục</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-2.5 flex-1">
            {statusStats.map((item) => {
              const isSelected = activeStatusFilter === item.status;
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() =>
                    setActiveStatusFilter((prev) => (prev === item.status ? null : item.status))
                  }
                  className={`w-full text-left rounded-lg px-3 py-2 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                    isSelected
                      ? 'bg-orange-50/70 border-orange-300'
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                        0{item.meta.step}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          isSelected ? 'text-orange-900' : 'text-slate-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums">
                      <span className="font-mono text-xs text-slate-500">{item.pct}%</span>
                      <span className="font-mono text-sm font-semibold text-slate-900 w-6 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${item.count > 0 ? Math.max(4, item.barWidthPct) : 0}%`,
                        backgroundColor: item.meta.barColor,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Hình thức & Khả năng nhân rộng
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Phân bổ chiến lược nhân rộng GO-P / GO-C / GO-M và NO-GO.
              </p>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
                <span>Khả năng nhân rộng: Có ({replicableCount})</span>
                <span>Không ({nonReplicableCount})</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                {totalCount > 0 && (
                  <>
                    <div
                      className="h-full bg-[#00A651] transition-all duration-300"
                      style={{ width: `${(replicableCount / totalCount) * 100}%` }}
                      title={`Có thể nhân rộng: ${replicableCount}`}
                    />
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${(nonReplicableCount / totalCount) * 100}%` }}
                      title={`Không nhân rộng: ${nonReplicableCount}`}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {modeStats.map((item) => {
                const isSelected = activeModeFilter === item.mode;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() =>
                      setActiveModeFilter((prev) => (prev === item.mode ? null : item.mode))
                    }
                    className={`w-full text-left p-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      isSelected
                        ? 'bg-orange-50/70 border-orange-300'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.meta.color }}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {item.mode}
                        </span>
                        <span className="text-xs text-slate-600 truncate">
                          {item.meta.shortLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                        <span className="font-mono text-xs text-slate-500">{item.pct}%</span>
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
            Quy ước FPT DX: <strong className="text-slate-700 font-medium">GO-P</strong> đóng gói thương mại,{' '}
            <strong className="text-slate-700 font-medium">GO-C</strong> tùy biến theo đơn vị,{' '}
            <strong className="text-slate-700 font-medium">GO-M</strong> tích hợp nền tảng dùng chung.
          </div>
        </section>
      </div>

      {/* Spotlight Product Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {hasActiveFilter ? 'Danh sách sản phẩm theo bộ lọc đang chọn' : 'Sản phẩm cập nhật gần đây'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Hiển thị {tableProducts.length} sản phẩm
              {activeStatusFilter ? ` · Trạng thái: ${activeStatusFilter}` : ''}
              {activeModeFilter ? ` · Hình thức: ${activeModeFilter}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span>Xóa lọc</span>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onNavigateCatalog({
                  status: activeStatusFilter ?? 'ALL',
                  mode: activeModeFilter ?? 'ALL',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#005AAB] hover:bg-sky-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Xem tất cả trong Danh mục</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {tableProducts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              Không có sản phẩm nào khớp với điều kiện lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-6 pr-3 whitespace-nowrap">Mã</th>
                  <th className="py-3 px-3 whitespace-nowrap">Tên sản phẩm</th>
                  <th className="py-3 px-3 whitespace-nowrap">Trạng thái & Cập nhật</th>
                  <th className="py-3 px-3 whitespace-nowrap">Đơn vị chủ quản</th>
                  <th className="py-3 px-3 whitespace-nowrap">Hình thức</th>
                  <th className="py-3 pl-3 pr-6 text-right whitespace-nowrap">Liên kết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tableProducts.slice(0, 8).map((product) => {
                  const statusMeta = STATUS_META[product.status];
                  const modeMeta = REPLICATION_MODE_META[product.replicationMode];
                  return (
                    <tr
                      key={product.id}
                      onClick={() => onSelectProduct(product)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                    >
                      <td className="py-3 pl-6 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {product.code}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 max-w-[300px]">
                        <div className="truncate">{product.name}</div>
                        <div className="text-xs font-normal text-slate-500 truncate">
                          {product.source} · {product.implementingUnit}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className={`text-xs font-medium ${statusMeta.textClass}`}>
                          {product.status}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                          {formatDateTime(product.statusUpdatedAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-[200px] truncate">
                        {product.governingUnit}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block font-mono text-xs font-semibold px-2 py-0.5 rounded border ${modeMeta.bgTint} ${modeMeta.textClass}`}
                        >
                          {product.replicationMode}
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {product.links.length}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
