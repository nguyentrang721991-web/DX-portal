import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  TASK_STATUSES,
  type DeploymentTask,
  type DeploymentTaskFormData,
  type Product,
  type TaskStatus,
} from '../types/product.ts';
import { computeTaskHealth, getTodayLocalDateKey } from '../utils/formatters.ts';

interface DeploymentTaskModalProps {
  open: boolean;
  replicableProducts: Product[];
  existingTasks: DeploymentTask[];
  editingTask: DeploymentTask | null;
  defaultProductId?: string;
  defaultParentTask?: string;
  onClose: () => void;
  onSubmit: (data: DeploymentTaskFormData) => Promise<void>;
}

export function DeploymentTaskModal({
  open,
  replicableProducts,
  existingTasks,
  editingTask,
  defaultProductId,
  defaultParentTask,
  onClose,
  onSubmit,
}: DeploymentTaskModalProps) {
  const [productId, setProductId] = useState('');
  const [parentTask, setParentTask] = useState('');
  const [subTask, setSubTask] = useState('');
  const [pic, setPic] = useState('');
  const [collaborators, setCollaborators] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<TaskStatus>('New');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = getTodayLocalDateKey();
    if (editingTask) {
      setProductId(editingTask.productId);
      setParentTask(editingTask.parentTask);
      setSubTask(editingTask.subTask);
      setPic(editingTask.pic);
      setCollaborators(editingTask.collaborators);
      setStartDate(editingTask.startDate);
      setEndDate(editingTask.endDate);
      setOutput(editingTask.output);
      setStatus(editingTask.status);
      setProgress(editingTask.progress);
    } else {
      const initialProductId =
        defaultProductId && replicableProducts.some((p) => p.id === defaultProductId)
          ? defaultProductId
          : replicableProducts[0]?.id || '';
      setProductId(initialProductId);
      setParentTask(defaultParentTask || '');
      setSubTask('');
      setPic('');
      setCollaborators('');
      setStartDate(today);
      setEndDate(today);
      setOutput('');
      setStatus('New');
      setProgress(0);
    }
    setError('');
  }, [open, editingTask, defaultProductId, defaultParentTask, replicableProducts]);

  const parentTaskSuggestions = useMemo(() => {
    const set = new Set<string>();
    existingTasks
      .filter((t) => t.productId === productId)
      .forEach((t) => {
        if (t.parentTask) set.add(t.parentTask);
      });
    return Array.from(set);
  }, [existingTasks, productId]);

  const liveHealth = useMemo(() => computeTaskHealth(endDate, status), [endDate, status]);

  if (!open) return null;

  const handleStatusChange = (nextStatus: TaskStatus) => {
    setStatus(nextStatus);
    if (nextStatus === 'Done') {
      setProgress(100);
    } else if (nextStatus === 'New' && progress === 100) {
      setProgress(0);
    } else if (nextStatus === 'In-progress' && progress === 0) {
      setProgress(25);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productId) {
      setError('Vui lòng chọn sản phẩm nhân rộng.');
      return;
    }
    if (!parentTask.trim()) {
      setError('Vui lòng nhập Đầu việc cha.');
      return;
    }
    if (!subTask.trim()) {
      setError('Vui lòng nhập Đầu việc con.');
      return;
    }
    if (!pic.trim()) {
      setError('Vui lòng nhập PIC phụ trách.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End_date không thể nhỏ hơn Start_date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        productId,
        parentTask: parentTask.trim(),
        subTask: subTask.trim(),
        pic: pic.trim(),
        collaborators: collaborators.trim(),
        startDate,
        endDate,
        output: output.trim(),
        status,
        progress: status === 'Done' ? 100 : Math.max(0, Math.min(100, Number(progress) || 0)),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu đầu việc triển khai.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="task-modal-title" className="font-display text-lg font-bold text-slate-900">
              {editingTask ? 'Chỉnh sửa đầu việc triển khai' : 'Thêm đầu việc triển khai mới'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Áp dụng cho các sản phẩm đủ điều kiện nhân rộng (Khả năng nhân rộng: Có).
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sản phẩm nhân rộng <span className="text-red-600">*</span>
            </label>
            <select
              value={productId}
              required
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {replicableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.implementingUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Đầu việc cha <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                list="parent-task-suggestions"
                value={parentTask}
                onChange={(e) => setParentTask(e.target.value)}
                placeholder="VD: 1. Chuẩn bị hạ tầng & Tích hợp lõi"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <datalist id="parent-task-suggestions">
                {parentTaskSuggestions.map((pt) => (
                  <option key={pt} value={pt} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Đầu việc con <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={subTask}
                onChange={(e) => setSubTask(e.target.value)}
                placeholder="VD: Cấu hình SSO & phân quyền đơn vị"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                PIC (Người phụ trách) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder="VD: Nguyễn Hoàng Nam"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bên phối hợp
              </label>
              <input
                type="text"
                value={collaborators}
                onChange={(e) => setCollaborators(e.target.value)}
                placeholder="VD: IT Đơn vị, FHO-DXO"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Start_date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                End_date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Output (Sản phẩm đầu ra)
            </label>
            <input
              type="text"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder="VD: Tài liệu HLD, API kết nối hoặc Biên bản nghiệm thu UAT"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-100">
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Trạng thái
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
                {TASK_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      status === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Tiến độ (%)</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  disabled={status === 'Done'}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 accent-[#F37021]"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  disabled={status === 'Done'}
                  onChange={(e) =>
                    setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                  }
                  className="w-16 px-2 py-1 text-xs font-mono text-right bg-white border border-slate-200 rounded-md tabular-nums"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <div className="text-xs font-medium text-slate-500 mb-1">Tình trạng dự kiến</div>
              <div
                className={`px-3 py-2 rounded-lg border text-xs font-semibold text-center ${
                  liveHealth.health === 'Chậm'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {liveHealth.health}
                {liveHealth.overdueDays > 0 ? ` (${liveHealth.overdueDays} ngày)` : ''}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : editingTask ? 'Lưu đầu việc' : 'Thêm đầu việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
