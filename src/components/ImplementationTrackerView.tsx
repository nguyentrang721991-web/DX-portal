import { useMemo, useState } from 'react';
import {
  Download,
  FilterX,
  Pencil,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  TASK_STATUSES,
  REPLICATION_MODE_META,
  type DeploymentTask,
  type DeploymentTaskFormData,
  type Product,
  type TaskHealth,
  type TaskStatus,
} from '../types/product.ts';
import {
  computeTaskHealth,
  exportDeploymentTasksToCsv,
  formatDateTime,
} from '../utils/formatters.ts';
import { DeploymentTaskModal } from './DeploymentTaskModal.tsx';

interface ImplementationTrackerViewProps {
  products: Product[];
  tasks: DeploymentTask[];
  onCreateTask: (data: DeploymentTaskFormData) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<DeploymentTaskFormData>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onSelectProduct: (product: Product) => void;
}

export function ImplementationTrackerView({
  products,
  tasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onSelectProduct,
}: ImplementationTrackerViewProps) {
  const replicableProducts = useMemo(
    () =>
      products
        .filter((p) => p.isReplicable === 'Có' && p.replicationMode !== 'NO-GO' && !p.isDraft)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [products]
  );

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    replicableProducts.forEach((p) => map.set(p.id, p));
    return map;
  }, [replicableProducts]);

  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [healthFilter, setHealthFilter] = useState<TaskHealth | 'ALL'>('ALL');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DeploymentTask | null>(null);
  const [modalDefaultProductId, setModalDefaultProductId] = useState<string | undefined>(undefined);
  const [modalDefaultParentTask, setModalDefaultParentTask] = useState<string | undefined>(undefined);
  const [deletingTask, setDeletingTask] = useState<DeploymentTask | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Only tasks belonging to replicable products
  const validTasks = useMemo(
    () => tasks.filter((t) => productMap.has(t.productId)),
    [tasks, productMap]
  );

  // Scope tasks by selected product before KPI / filter
  const productScopedTasks = useMemo(() => {
    if (selectedProductId === 'ALL') return validTasks;
    return validTasks.filter((t) => t.productId === selectedProductId);
  }, [validTasks, selectedProductId]);

  // KPI metrics for current product scope
  const kpi = useMemo(() => {
    const total = productScopedTasks.length;
    const done = productScopedTasks.filter((t) => t.status === 'Done').length;
    let delayed = 0;
    let onTrack = 0;
    let progressSum = 0;

    productScopedTasks.forEach((t) => {
      progressSum += t.progress;
      const { health } = computeTaskHealth(t.endDate, t.status);
      if (health === 'Chậm') delayed += 1;
      else onTrack += 1;
    });

    const avgProgress = total > 0 ? Math.round(progressSum / total) : 0;
    return { total, done, delayed, onTrack, avgProgress };
  }, [productScopedTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productScopedTasks.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      const { health } = computeTaskHealth(t.endDate, t.status);
      if (healthFilter !== 'ALL' && health !== healthFilter) return false;

      if (q) {
        const prod = productMap.get(t.productId);
        const haystack = [
          prod?.code || '',
          prod?.name || '',
          t.parentTask,
          t.subTask,
          t.pic,
          t.collaborators,
          t.output,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [productScopedTasks, statusFilter, healthFilter, searchQuery, productMap]);

  // Group filtered tasks by Product -> Parent Task
  const groupedByProduct = useMemo(() => {
    const prodGroups = new Map<
      string,
      {
        product: Product;
        parentGroups: Map<string, DeploymentTask[]>;
        totalTasks: number;
        avgProgress: number;
        delayedCount: number;
      }
    >();

    for (const task of filteredTasks) {
      const prod = productMap.get(task.productId);
      if (!prod) continue;

      let pGroup = prodGroups.get(prod.id);
      if (!pGroup) {
        pGroup = {
          product: prod,
          parentGroups: new Map<string, DeploymentTask[]>(),
          totalTasks: 0,
          avgProgress: 0,
          delayedCount: 0,
        };
        prodGroups.set(prod.id, pGroup);
      }

      const parentKey = task.parentTask || 'Đầu việc chung';
      const list = pGroup.parentGroups.get(parentKey) || [];
      list.push(task);
      pGroup.parentGroups.set(parentKey, list);
      pGroup.totalTasks += 1;
      if (computeTaskHealth(task.endDate, task.status).health === 'Chậm') {
        pGroup.delayedCount += 1;
      }
    }

    // Compute averages and sort tasks by startDate inside each parent group
    for (const pGroup of prodGroups.values()) {
      let sum = 0;
      for (const list of pGroup.parentGroups.values()) {
        list.sort((a, b) => a.startDate.localeCompare(b.startDate));
        list.forEach((t) => {
          sum += t.progress;
        });
      }
      pGroup.avgProgress = pGroup.totalTasks > 0 ? Math.round(sum / pGroup.totalTasks) : 0;
    }

    return Array.from(prodGroups.values()).sort((a, b) =>
      a.product.code.localeCompare(b.product.code)
    );
  }, [filteredTasks, productMap]);

  const hasFilters =
    selectedProductId !== 'ALL' ||
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    healthFilter !== 'ALL';

  const resetFilters = () => {
    setSelectedProductId('ALL');
    setSearchQuery('');
    setStatusFilter('ALL');
    setHealthFilter('ALL');
  };

  const openAddTask = (productId?: string, parentTask?: string) => {
    setEditingTask(null);
    setModalDefaultProductId(
      productId || (selectedProductId !== 'ALL' ? selectedProductId : replicableProducts[0]?.id)
    );
    setModalDefaultParentTask(parentTask);
    setTaskModalOpen(true);
  };

  const openEditTask = (task: DeploymentTask) => {
    setEditingTask(task);
    setModalDefaultProductId(undefined);
    setModalDefaultParentTask(undefined);
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = async (data: DeploymentTaskFormData) => {
    if (editingTask) {
      await onUpdateTask(editingTask.id, data);
    } else {
      await onCreateTask(data);
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!deletingTask) return;
    setDeletingBusy(true);
    try {
      await onDeleteTask(deletingTask.id);
      setDeletingTask(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Theo dõi Triển khai Sản phẩm Nhân rộng
          </h1>
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Theo dõi chi tiết đầu việc cha/con, PIC, tiến độ (%) và tình trạng đúng hạn cho{' '}
            {replicableProducts.length} sản phẩm nhân rộng được.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => exportDeploymentTasksToCsv(filteredTasks, productMap)}
            disabled={filteredTasks.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất CSV ({filteredTasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => openAddTask()}
            disabled={replicableProducts.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm đầu việc</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Tổng hợp tiến độ triển khai">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setHealthFilter('ALL');
          }}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Tổng đầu việc con</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-slate-900 tabular-nums">
              {kpi.total}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              TB {kpi.avgProgress}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            Thuộc {selectedProductId === 'ALL' ? `${replicableProducts.length} sản phẩm nhân rộng` : 'sản phẩm đang chọn'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setHealthFilter('ALL');
            setStatusFilter((prev) => (prev === 'Done' ? 'ALL' : 'Done'));
          }}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Hoàn thành (Done)</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-[#005AAB] tabular-nums">
              {kpi.done}
            </span>
            <span className="font-mono text-xs font-medium text-[#005AAB] tabular-nums">
              {kpi.total > 0 ? Math.round((kpi.done / kpi.total) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 tabular-nums">
            In-progress: {productScopedTasks.filter((t) => t.status === 'In-progress').length} · New:{' '}
            {productScopedTasks.filter((t) => t.status === 'New').length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setHealthFilter((prev) => (prev === 'Đúng tiến độ' ? 'ALL' : 'Đúng tiến độ'));
          }}
          className="text-left bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-5 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Đúng tiến độ</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-emerald-700 tabular-nums">
              {kpi.onTrack}
            </span>
            <span className="font-mono text-xs font-medium text-emerald-700 tabular-nums">
              {kpi.total > 0 ? Math.round((kpi.onTrack / kpi.total) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Bao gồm Done hoặc chưa quá End_date
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setHealthFilter((prev) => (prev === 'Chậm' ? 'ALL' : 'Chậm'));
          }}
          className="text-left bg-white border border-slate-200 hover:border-red-300 rounded-xl p-5 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Chậm tiến độ</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-3xl font-bold text-red-600 tabular-nums">
              {kpi.delayed}
            </span>
            <span className="font-mono text-xs font-medium text-red-600 tabular-nums">
              {kpi.total > 0 ? Math.round((kpi.delayed / kpi.total) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Quá End_date & trạng thái khác Done
          </div>
        </button>
      </section>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              aria-label="Chọn sản phẩm nhân rộng"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">
                Tất cả sản phẩm nhân rộng ({replicableProducts.length})
              </option>
              {replicableProducts.map((p) => {
                const count = validTasks.filter((t) => t.productId === p.id).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({count} việc)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm đầu việc, PIC, bên phối hợp, output..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="md:col-span-3">
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
              {(['ALL', ...TASK_STATUSES] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'Tất cả' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as TaskHealth | 'ALL')}
              aria-label="Lọc theo tình trạng"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Tình trạng: Tất cả</option>
              <option value="Đúng tiến độ">Đúng tiến độ</option>
              <option value="Chậm">Chậm</option>
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span>Đang áp dụng bộ lọc theo dõi triển khai</span>
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

      {/* Grouped Product & Parent/Sub-Task Tables */}
      {groupedByProduct.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-800">
            Chưa có đầu việc triển khai nào khớp với bộ lọc hiện tại.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Chọn sản phẩm nhân rộng và tạo đầu việc cha/con để bắt đầu theo dõi tiến độ.
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
              onClick={() => openAddTask()}
              disabled={replicableProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm đầu việc mới</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByProduct.map(({ product, parentGroups, totalTasks, avgProgress, delayedCount }) => {
            const modeMeta = REPLICATION_MODE_META[product.replicationMode];
            return (
              <section
                key={product.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                {/* Product Group Header */}
                <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{product.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>Đơn vị triển khai: {product.implementingUnit}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono font-semibold px-1.5 py-0.5 rounded border ${modeMeta.bgTint} ${modeMeta.textClass}`}
                      >
                        {product.replicationMode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(product)}
                      className="mt-1 font-display text-base font-bold text-slate-900 hover:text-[#005AAB] transition-colors text-left"
                    >
                      {product.name}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <div className="text-xs text-slate-600 tabular-nums">
                      <span className="font-mono font-semibold text-slate-900">{totalTasks}</span>{' '}
                      đầu việc · Tiến độ TB{' '}
                      <span className="font-mono font-semibold text-[#005AAB]">{avgProgress}%</span>
                      {delayedCount > 0 && (
                        <span className="ml-2 font-semibold text-red-600">
                          · {delayedCount} chậm
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddTask(product.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm đầu việc</span>
                    </button>
                  </div>
                </div>

                {/* Task Table grouped by Đầu việc cha */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1040px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white text-[11px] font-medium text-slate-500">
                        <th className="py-2.5 pl-6 pr-3 whitespace-nowrap w-[260px]">
                          Đầu việc cha / Đầu việc con
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[170px]">
                          PIC & Bên phối hợp
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[140px]">
                          Start_date – End_date
                        </th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[200px]">Output</th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[115px]">Trạng thái</th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[125px]">Tiến độ (%)</th>
                        <th className="py-2.5 px-3 whitespace-nowrap w-[115px]">Tình trạng</th>
                        <th className="py-2.5 pl-2 pr-6 text-right whitespace-nowrap w-[80px]">
                          Thao tác
                        </th>
                      </tr>
                    </thead>

                    <tbody className="text-xs divide-y divide-slate-100">
                      {Array.from(parentGroups.entries()).map(([parentName, subTasks]) => {
                        const parentProgress = Math.round(
                          subTasks.reduce((acc, t) => acc + t.progress, 0) / subTasks.length
                        );
                        return (
                          <FragmentGroup
                            key={`${product.id}-${parentName}`}
                            productId={product.id}
                            parentName={parentName}
                            parentProgress={parentProgress}
                            subTasks={subTasks}
                            onAddSubTask={() => openAddTask(product.id, parentName)}
                            onUpdateTask={onUpdateTask}
                            onEditTask={openEditTask}
                            onDeleteTask={setDeletingTask}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      <DeploymentTaskModal
        open={taskModalOpen}
        replicableProducts={replicableProducts}
        existingTasks={tasks}
        editingTask={editingTask}
        defaultProductId={modalDefaultProductId}
        defaultParentTask={modalDefaultParentTask}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={handleTaskSubmit}
      />

      {/* Delete Task Confirmation Modal */}
      {deletingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h2 id="delete-task-title" className="font-display text-base font-bold text-slate-900">
                  Xác nhận xóa đầu việc
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa đầu việc con{' '}
              <strong className="text-slate-900 font-semibold">{deletingTask.subTask}</strong>{' '}
              (thuộc <em>{deletingTask.parentTask}</em>)?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                disabled={deletingBusy}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                disabled={deletingBusy}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingBusy ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FragmentGroupProps {
  productId: string;
  parentName: string;
  parentProgress: number;
  subTasks: DeploymentTask[];
  onAddSubTask: () => void;
  onUpdateTask: (id: string, data: Partial<DeploymentTaskFormData>) => Promise<void>;
  onEditTask: (task: DeploymentTask) => void;
  onDeleteTask: (task: DeploymentTask) => void;
}

function FragmentGroup({
  parentName,
  parentProgress,
  subTasks,
  onAddSubTask,
  onUpdateTask,
  onEditTask,
  onDeleteTask,
}: FragmentGroupProps) {
  return (
    <>
      {/* Parent Workstream Row */}
      <tr className="bg-slate-50/90 border-t border-slate-200">
        <td colSpan={5} className="py-2.5 pl-6 pr-3 font-semibold text-slate-900">
          <div className="flex items-center gap-2">
            <span>{parentName}</span>
            <span className="font-mono text-[11px] font-normal text-slate-500 tabular-nums">
              ({subTasks.length} việc con)
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#005AAB] rounded-sm"
                style={{ width: `${parentProgress}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums w-8 text-right">
              {parentProgress}%
            </span>
          </div>
        </td>
        <td colSpan={2} className="py-2.5 pl-2 pr-6 text-right">
          <button
            type="button"
            onClick={onAddSubTask}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#005AAB] hover:underline whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm việc con</span>
          </button>
        </td>
      </tr>

      {/* Sub-task Rows */}
      {subTasks.map((task) => {
        const { health, overdueDays } = computeTaskHealth(task.endDate, task.status);
        return (
          <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
            <td className="py-3 pl-9 pr-3 align-top">
              <div className="font-medium text-slate-900 leading-snug">{task.subTask}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{task.parentTask}</div>
            </td>
            <td className="py-3 px-3 align-top">
              <div className="font-medium text-slate-800">{task.pic || '—'}</div>
              {task.collaborators && (
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Phối hợp: {task.collaborators}
                </div>
              )}
            </td>
            <td className="py-3 px-3 align-top font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
              <div>BĐ: {formatDateTime(task.startDate)}</div>
              <div className="mt-0.5 text-slate-800 font-medium">
                KT: {formatDateTime(task.endDate)}
              </div>
            </td>
            <td className="py-3 px-3 align-top text-slate-700 leading-snug max-w-[220px]">
              {task.output || <span className="text-slate-400">Chưa cập nhật</span>}
            </td>
            <td className="py-3 px-3 align-top">
              <select
                value={task.status}
                aria-label={`Trạng thái đầu việc ${task.subTask}`}
                onChange={(e) => {
                  const nextStatus = e.target.value as TaskStatus;
                  onUpdateTask(task.id, {
                    status: nextStatus,
                    progress:
                      nextStatus === 'Done'
                        ? 100
                        : nextStatus === 'New' && task.progress === 100
                          ? 0
                          : task.progress,
                  });
                }}
                className={`px-2 py-1 text-xs font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  task.status === 'Done'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : task.status === 'In-progress'
                      ? 'bg-orange-50 border-orange-200 text-orange-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {TASK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </td>
            <td className="py-3 px-3 align-top">
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all ${
                      task.status === 'Done'
                        ? 'bg-[#00A651]'
                        : health === 'Chậm'
                          ? 'bg-red-500'
                          : 'bg-[#F37021]'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums w-9 text-right">
                  {task.progress}%
                </span>
              </div>
            </td>
            <td className="py-3 px-3 align-top whitespace-nowrap">
              <div
                className={`font-medium pt-1 ${
                  health === 'Chậm' ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {health}
              </div>
              {overdueDays > 0 && (
                <div className="text-[11px] font-mono text-red-500 tabular-nums">
                  Quá {overdueDays} ngày
                </div>
              )}
            </td>
            <td className="py-3 pl-2 pr-6 align-top text-right whitespace-nowrap">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  className="p-1.5 text-slate-500 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                  title="Chỉnh sửa đầu việc"
                  aria-label={`Chỉnh sửa ${task.subTask}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTask(task)}
                  className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  title="Xóa đầu việc"
                  aria-label={`Xóa ${task.subTask}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}
