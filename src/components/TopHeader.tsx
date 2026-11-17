import { Menu, Plus, ArrowLeft } from 'lucide-react';

interface TopHeaderProps {
  breadcrumbs: { label: string; onClick?: () => void }[];
  onOpenMobileMenu: () => void;
  onAddProduct: () => void;
  onBack?: () => void;
}

export function TopHeader({
  breadcrumbs,
  onOpenMobileMenu,
  onAddProduct,
  onBack,
}: TopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Quay lại</span>
          </button>
        )}

        <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={`${crumb.label}-${idx}`} className="flex items-center gap-2 min-w-0">
                {idx > 0 && (
                  <span className="text-slate-300 select-none shrink-0" aria-hidden="true">
                    /
                  </span>
                )}
                {crumb.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="text-slate-500 hover:text-slate-900 transition-colors truncate whitespace-nowrap"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={`truncate ${
                      isLast ? 'font-semibold text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {crumb.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onAddProduct}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#F37021] hover:bg-[#D95B10] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Thêm sản phẩm</span>
        </button>
      </div>
    </header>
  );
}
