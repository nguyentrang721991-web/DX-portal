import type {
  DeploymentTask,
  DeploymentTaskFormData,
  Product,
  ProductFormData,
  SaveMode,
} from '../types/product.ts';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = 'Đã có lỗi xảy ra khi kết nối máy chủ.';
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const productsApi = {
  async list(): Promise<Product[]> {
    const res = await fetch('/api/products');
    return handleResponse<Product[]>(res);
  },

  async create(data: ProductFormData, saveMode: SaveMode = 'publish'): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, saveMode }),
    });
    return handleResponse<Product>(res);
  },

  async update(
    id: string,
    data: Partial<ProductFormData>,
    saveMode: SaveMode = 'publish'
  ): Promise<Product> {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, saveMode }),
    });
    return handleResponse<Product>(res);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return handleResponse<{ deleted: boolean; id: string }>(res);
  },

  async reset(): Promise<Product[]> {
    const res = await fetch('/api/products/reset', {
      method: 'POST',
    });
    return handleResponse<Product[]>(res);
  },
};

export const deploymentTasksApi = {
  async list(): Promise<DeploymentTask[]> {
    const res = await fetch('/api/deployment-tasks');
    return handleResponse<DeploymentTask[]>(res);
  },

  async create(data: DeploymentTaskFormData): Promise<DeploymentTask> {
    const res = await fetch('/api/deployment-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<DeploymentTask>(res);
  },

  async update(id: string, data: Partial<DeploymentTaskFormData>): Promise<DeploymentTask> {
    const res = await fetch(`/api/deployment-tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<DeploymentTask>(res);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    const res = await fetch(`/api/deployment-tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return handleResponse<{ deleted: boolean; id: string }>(res);
  },
};
