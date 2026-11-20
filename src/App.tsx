import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { TopHeader } from './components/TopHeader.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProductCatalogView } from './components/ProductCatalogView.tsx';
import { ImplementationTrackerView } from './components/ImplementationTrackerView.tsx';
import { ProductDetailView } from './components/ProductDetailView.tsx';
import { ProductFormModal } from './components/ProductFormModal.tsx';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal.tsx';
import { deploymentTasksApi, productsApi } from './utils/api.ts';
import type {
  DeploymentTask,
  DeploymentTaskFormData,
  Product,
  ProductFormData,
  ProductLink,
  ProductStatus,
  ReplicationMode,
  SaveMode,
  StatusHistoryEntry,
} from './types/product.ts';

interface CatalogPreset {
  status?: ProductStatus | 'ALL';
  mode?: ReplicationMode | 'ALL';
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [deploymentTasks, setDeploymentTasks] = useState<DeploymentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [catalogPreset, setCatalogPreset] = useState<CatalogPreset>({});
  const [catalogKey, setCatalogKey] = useState(0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prods, tasks] = await Promise.all([
        productsApi.list(),
        deploymentTasksApi.list(),
      ]);
      setProducts(prods);
      setDeploymentTasks(tasks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không thể tải dữ liệu hệ thống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const handleSelectTab = (tab: NavTab) => {
    setSelectedProductId(null);
    setActiveTab(tab);
    if (tab === 'catalog') {
      setCatalogPreset({});
      setCatalogKey((k) => k + 1);
    }
  };

  const handleNavigateCatalog = (preset: CatalogPreset = {}) => {
    setSelectedProductId(null);
    setCatalogPreset(preset);
    setCatalogKey((k) => k + 1);
    setActiveTab('catalog');
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (data: ProductFormData, saveMode: SaveMode) => {
    if (editingProduct) {
      const updated = await productsApi.update(editingProduct.id, data, saveMode);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingProduct(updated);
      if (saveMode === 'draft') {
        showToast(
          updated.isDraft
            ? `Đã lưu nháp bản ghi ${updated.code}.`
            : `Đã lưu nháp thay đổi cho ${updated.code} (bản chính thức được giữ nguyên).`
        );
      } else {
        showToast(
          editingProduct.isDraft
            ? `Đã hoàn tất & lưu chính thức sản phẩm ${updated.code}.`
            : `Đã cập nhật chính thức sản phẩm ${updated.code}.`
        );
      }
    } else {
      const created = await productsApi.create(data, saveMode);
      setProducts((prev) => [created, ...prev]);
      setSelectedProductId(created.id);
      showToast(
        saveMode === 'draft'
          ? `Đã lưu nháp sản phẩm ${created.code}.`
          : `Đã thêm mới sản phẩm ${created.code}.`
      );
    }
  };

  const handleDiscardDraft = async (productId: string) => {
    const updated = await productsApi.update(productId, {}, 'discard-draft');
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingProduct((prev) => (prev?.id === updated.id ? updated : prev));
    showToast(`Đã xóa bản nháp chỉnh sửa cho ${updated.code}.`);
  };

  const handleQuickUpdateStatus = async (productId: string, status: ProductStatus) => {
    const updated = await productsApi.update(productId, {
      status,
      statusUpdatedAt: new Date().toISOString(),
    });
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast(`Đã chuyển trạng thái sang "${status}".`);
  };

  const handleQuickUpdateStatusHistory = async (
    productId: string,
    statusHistory: StatusHistoryEntry[],
    latestUpdatedAt?: string
  ) => {
    const updated = await productsApi.update(productId, {
      statusHistory,
      statusUpdatedAt: latestUpdatedAt,
    });
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast('Đã cập nhật mốc thời gian trạng thái.');
  };

  const handleQuickUpdateLinks = async (productId: string, links: ProductLink[]) => {
    const updated = await productsApi.update(productId, { links });
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast('Đã cập nhật danh sách liên kết.');
  };

  const handleConfirmDelete = async (product: Product) => {
    await productsApi.remove(product.id);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    setDeploymentTasks((prev) => prev.filter((t) => t.productId !== product.id));
    if (selectedProductId === product.id) {
      setSelectedProductId(null);
    }
    setDeletingProduct(null);
    showToast(`Đã xóa sản phẩm ${product.code}.`);
  };

  // Deployment Task Handlers
  const handleCreateTask = async (data: DeploymentTaskFormData) => {
    const created = await deploymentTasksApi.create(data);
    setDeploymentTasks((prev) => [...prev, created]);
    showToast('Đã thêm đầu việc triển khai mới.');
  };

  const handleUpdateTask = async (id: string, data: Partial<DeploymentTaskFormData>) => {
    const updated = await deploymentTasksApi.update(id, data);
    setDeploymentTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    showToast('Đã cập nhật đầu việc triển khai.');
  };

  const handleDeleteTask = async (id: string) => {
    await deploymentTasksApi.remove(id);
    setDeploymentTasks((prev) => prev.filter((t) => t.id !== id));
    showToast('Đã xóa đầu việc triển khai.');
  };

  const handleResetDemoData = async () => {
    try {
      const freshProducts = await productsApi.reset();
      const freshTasks = await deploymentTasksApi.list();
      setProducts(freshProducts);
      setDeploymentTasks(freshTasks);
      setSelectedProductId(null);
      showToast('Đã khôi phục bộ dữ liệu mẫu FPT DX.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể khôi phục dữ liệu.');
    }
  };

  const breadcrumbs = useMemo(() => {
    const rootLabel = 'FPT DX Replication';
    if (selectedProduct) {
      return [
        { label: rootLabel, onClick: () => handleSelectTab('dashboard') },
        { label: 'Danh mục sản phẩm', onClick: () => handleNavigateCatalog() },
        { label: `${selectedProduct.code} — ${selectedProduct.name}` },
      ];
    }
    if (activeTab === 'dashboard') {
      return [{ label: rootLabel }, { label: 'Tổng quan Dashboard' }];
    }
    if (activeTab === 'catalog') {
      return [{ label: rootLabel, onClick: () => handleSelectTab('dashboard') }, { label: 'Danh mục sản phẩm' }];
    }
    return [{ label: rootLabel, onClick: () => handleSelectTab('dashboard') }, { label: 'Theo dõi triển khai' }];
  }, [activeTab, selectedProduct]);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        products={products}
        onResetDemoData={handleResetDemoData}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          breadcrumbs={breadcrumbs}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onAddProduct={handleOpenAddModal}
          onBack={selectedProduct ? () => setSelectedProductId(null) : undefined}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {loading ? (
            <div className="space-y-6 animate-pulse" aria-label="Đang tải dữ liệu">
              <div className="h-8 w-80 bg-slate-200 rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
                ))}
              </div>
              <div className="h-72 bg-white border border-slate-200 rounded-xl" />
            </div>
          ) : loadError ? (
            <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto my-12">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Không thể tải dữ liệu hệ thống
              </h2>
              <p className="mt-1 text-sm text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={fetchAllData}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Thử lại
              </button>
            </div>
          ) : selectedProduct ? (
            <ProductDetailView
              product={selectedProduct}
              deploymentTasks={deploymentTasks.filter((t) => t.productId === selectedProduct.id)}
              onEdit={handleOpenEditModal}
              onDelete={setDeletingProduct}
              onDiscardDraft={handleDiscardDraft}
              onQuickUpdateStatus={handleQuickUpdateStatus}
              onQuickUpdateStatusHistory={handleQuickUpdateStatusHistory}
              onQuickUpdateLinks={handleQuickUpdateLinks}
            />
          ) : activeTab === 'dashboard' ? (
            <DashboardView
              products={products}
              onSelectProduct={(p) => setSelectedProductId(p.id)}
              onNavigateCatalog={handleNavigateCatalog}
            />
          ) : activeTab === 'catalog' ? (
            <ProductCatalogView
              key={catalogKey}
              products={products}
              initialStatusFilter={catalogPreset.status}
              initialModeFilter={catalogPreset.mode}
              onSelectProduct={(p) => setSelectedProductId(p.id)}
              onEditProduct={handleOpenEditModal}
              onDeleteProduct={setDeletingProduct}
              onAddProduct={handleOpenAddModal}
            />
          ) : (
            <ImplementationTrackerView
              products={products}
              tasks={deploymentTasks}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onSelectProduct={(p) => setSelectedProductId(p.id)}
            />
          )}
        </main>
      </div>

      {/* Create / Edit Product Modal */}
      <ProductFormModal
        open={formModalOpen}
        editingProduct={editingProduct}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        onDiscardDraft={handleDiscardDraft}
      />

      {/* Delete Product Confirmation Modal */}
      <ConfirmDeleteModal
        product={deletingProduct}
        onCancel={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Non-intrusive Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg border border-slate-700"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
