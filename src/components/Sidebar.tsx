import { LayoutDashboard, Layers, ListChecks, RotateCcw, X } from 'lucide-react';
import { FptBrandMark } from './FptBrandMark.tsx';
import type { Product } from '../types/product.ts';

export type NavTab = 'dashboard' | 'catalog' | 'implementation';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  products: Product[];
  onResetDemoData: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  products,
  onResetDemoData,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const officialProducts = products.filter((p) => !p.isDraft);
  const draftCount = products.filter((p) => p.isDraft || Boolean(p.draftData)).length;
  const goliveCount = officialProducts.filter(
    (p) => p.status === 'Đã golive' || p.status === 'Theo dõi vận hành'
  ).length;
  const activeCount = officialProducts.filter(
    (p) =>
      p.status === 'Đang triển khai' ||
      p.status === 'Đang lên kế hoạch chi tiết' ||
      p.status === 'Đã được duyệt chủ trương'
  ).length;
  const goCount = officialProducts.filter((p) => p.isReplicable === 'Có').length;

  const navItems: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Tổng quan Dashboard', icon: LayoutDashboard },
    { id: 'catalog', label: 'Danh mục sản phẩm', icon: Layers },
    { id: 'implementation', label: 'Theo dõi triển khai', icon: ListChecks },
  ];

  const content = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 text-slate-900">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectTab('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-md"
        >
          <FptBrandMark className="w-8 h-8 shrink-0" />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            FPT DX Replication
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          aria-label="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Điều hướng chính">
        <div className="px-3 pb-2 text-xs font-medium text-slate-400">
          Không gian quản trị
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                isActive
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F37021]' : 'text-slate-400'}`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Quick Portfolio Summary */}
        <div className="pt-6 px-3">
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="text-xs font-medium text-slate-400">Chỉ số nhanh danh mục</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Tổng sản phẩm</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {officialProducts.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Golive & Vận hành</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                  {goliveCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Đang triển khai / KH</span>
                <span className="font-mono font-semibold text-orange-700 tabular-nums">
                  {activeCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Khả năng nhân rộng</span>
                <span className="font-mono font-semibold text-sky-700 tabular-nums">
                  {goCount}/{officialProducts.length}
                </span>
              </div>
              {draftCount > 0 && (
                <div className="flex items-center justify-between text-amber-700 pt-1 border-t border-slate-100">
                  <span>Bản nháp đang lưu</span>
                  <span className="font-mono font-semibold tabular-nums">{draftCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer Utility & Coordinator Profile */}
      <div className="border-t border-slate-200 p-4 space-y-3 shrink-0">
        <button
          type="button"
          onClick={onResetDemoData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Khôi phục dữ liệu mẫu</span>
        </button>

        <div className="flex items-center gap-3 pt-1">
          <img
            src="/src/assets/images/avatar_dx_lead_1794888107068.jpg"
            alt="Văn phòng chuyển đổi số FHO-DXO"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-900 truncate">
              Văn phòng chuyển đổi số
            </div>
            <div className="text-xs text-slate-500 truncate">FHO-DXO</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{content}</aside>
        </div>
      )}
    </>
  );
}
