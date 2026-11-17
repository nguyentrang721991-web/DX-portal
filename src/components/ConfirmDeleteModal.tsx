import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Product } from '../types/product.ts';

interface ConfirmDeleteModalProps {
  product: Product | null;
  onCancel: () => void;
  onConfirm: (product: Product) => Promise<void>;
}

export function ConfirmDeleteModal({
  product,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!product) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(product);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 id="delete-modal-title" className="font-display text-base font-bold text-slate-900">
              Xác nhận xóa sản phẩm
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Bạn có chắc chắn muốn xóa sản phẩm{' '}
          <strong className="text-slate-900 font-semibold">
            {product.code} — {product.name}
          </strong>{' '}
          khỏi danh mục quản lý? Thao tác này không thể hoàn tác.
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
