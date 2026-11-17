import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import type {
  DeploymentTask,
  DeploymentTaskFormData,
  Product,
  ProductFormData,
  SaveMode,
  StatusHistoryEntry,
} from './src/types/product.ts';
import { SEED_PRODUCTS } from './src/data/seedProducts.ts';
import { SEED_DEPLOYMENT_TASKS } from './src/data/seedDeploymentTasks.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'products.json');
const TASKS_FILE = path.resolve(DATA_DIR, 'deployment_tasks.json');
const PORT = Number(process.env.PORT) || 3000;

function normalizeProductRecord(raw: Record<string, unknown>): Product {
  const seedMatch = SEED_PRODUCTS.find((s) => s.id === raw.id);
  const now = new Date().toISOString();
  const legacyMonth = typeof raw.month === 'string' && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : null;
  const fallbackIso = legacyMonth
    ? `${legacyMonth}-15T09:00:00.000Z`
    : typeof raw.updatedAt === 'string'
      ? raw.updatedAt
      : now;

  let statusHistory: StatusHistoryEntry[] = [];
  if (Array.isArray(raw.statusHistory) && raw.statusHistory.length > 0) {
    statusHistory = raw.statusHistory as StatusHistoryEntry[];
  } else if (seedMatch) {
    statusHistory = seedMatch.statusHistory;
  } else {
    statusHistory = [
      {
        id: `sh-mig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        status: (raw.status as Product['status']) || 'Đánh giá sơ bộ',
        updatedAt: fallbackIso,
      },
    ];
  }

  const sortedHistory = [...statusHistory].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const latestEntry = sortedHistory[sortedHistory.length - 1];
  const statusUpdatedAt =
    typeof raw.statusUpdatedAt === 'string' && raw.statusUpdatedAt
      ? raw.statusUpdatedAt
      : latestEntry?.updatedAt || fallbackIso;

  return {
    id: String(raw.id || `dx-${Date.now()}`),
    code: String(raw.code || 'DX-000'),
    name: String(raw.name || ''),
    status: (raw.status as Product['status']) || latestEntry?.status || 'Đánh giá sơ bộ',
    statusUpdatedAt,
    statusHistory: sortedHistory,
    source: String(raw.source || ''),
    governingUnit: String(raw.governingUnit || ''),
    implementingUnit: String(raw.implementingUnit || ''),
    deploymentScope: String(raw.deploymentScope || ''),
    isReplicable: raw.isReplicable === 'Không' ? 'Không' : 'Có',
    replicationMode: (raw.replicationMode as Product['replicationMode']) || 'GO-P',
    nonReplicableReason: String(raw.nonReplicableReason || ''),
    links: Array.isArray(raw.links) ? (raw.links as Product['links']) : [],
    description: typeof raw.description === 'string' ? raw.description : '',
    isDraft: Boolean(raw.isDraft),
    draftData: (raw.draftData as ProductFormData | null | undefined) ?? null,
    draftUpdatedAt: typeof raw.draftUpdatedAt === 'string' ? raw.draftUpdatedAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallbackIso,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : statusUpdatedAt,
  };
}

function ensureStore(): Product[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_PRODUCTS, null, 2), 'utf-8');
    return [...SEED_PRODUCTS];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const needsMigration = parsed.some(
        (item) => !item || !Array.isArray(item.statusHistory) || item.statusHistory.length === 0
      );
      const normalized = parsed.map((item) => normalizeProductRecord(item as Record<string, unknown>));
      if (needsMigration) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
      }
      return normalized;
    }
  } catch {
    // Fallback to seed if corrupted
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_PRODUCTS, null, 2), 'utf-8');
  return [...SEED_PRODUCTS];
}

function writeStore(products: Product[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

function ensureTasksStore(): DeploymentTask[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(SEED_DEPLOYMENT_TASKS, null, 2), 'utf-8');
    return [...SEED_DEPLOYMENT_TASKS];
  }
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as DeploymentTask[];
    }
  } catch {
    // Fallback to seed
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(SEED_DEPLOYMENT_TASKS, null, 2), 'utf-8');
  return [...SEED_DEPLOYMENT_TASKS];
}

function writeTasksStore(tasks: DeploymentTask[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

function generateNextCode(products: Product[]): string {
  let maxNum = 0;
  for (const p of products) {
    const match = /^DX-(\d+)$/i.exec(p.code.trim());
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `DX-${String(maxNum + 1).padStart(3, '0')}`;
}

function sanitizeFormData(
  payload: Partial<ProductFormData>,
  fallback: Partial<ProductFormData> = {}
): ProductFormData {
  const now = new Date().toISOString();
  const status = payload.status ?? fallback.status ?? 'Đánh giá sơ bộ';
  const statusUpdatedAt = payload.statusUpdatedAt ?? fallback.statusUpdatedAt ?? now;
  const statusHistory =
    Array.isArray(payload.statusHistory) && payload.statusHistory.length > 0
      ? [...payload.statusHistory].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      : Array.isArray(fallback.statusHistory) && fallback.statusHistory.length > 0
        ? fallback.statusHistory
        : [{ id: `sh-${Date.now()}`, status, updatedAt: statusUpdatedAt }];

  const isReplicable =
    payload.isReplicable !== undefined
      ? payload.isReplicable === 'Không'
        ? 'Không'
        : 'Có'
      : fallback.isReplicable ?? 'Có';

  return {
    code: payload.code !== undefined ? payload.code.trim() : fallback.code || '',
    name: payload.name !== undefined ? payload.name.trim() : fallback.name || '',
    status,
    statusUpdatedAt,
    statusHistory,
    source: payload.source !== undefined ? payload.source.trim() : fallback.source || '',
    governingUnit:
      payload.governingUnit !== undefined ? payload.governingUnit.trim() : fallback.governingUnit || '',
    implementingUnit:
      payload.implementingUnit !== undefined
        ? payload.implementingUnit.trim()
        : fallback.implementingUnit || '',
    deploymentScope:
      payload.deploymentScope !== undefined
        ? payload.deploymentScope.trim()
        : fallback.deploymentScope || '',
    isReplicable,
    replicationMode:
      payload.replicationMode ?? fallback.replicationMode ?? (isReplicable === 'Không' ? 'NO-GO' : 'GO-P'),
    nonReplicableReason:
      payload.nonReplicableReason !== undefined
        ? payload.nonReplicableReason.trim()
        : fallback.nonReplicableReason || '',
    links: Array.isArray(payload.links)
      ? payload.links.filter((l) => l && typeof l.url === 'string' && l.url.trim().length > 0)
      : fallback.links || [],
    description:
      payload.description !== undefined ? payload.description.trim() : fallback.description || '',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  ensureStore();
  ensureTasksStore();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Products API
  app.get('/api/products', (_req, res) => {
    const products = ensureStore();
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const body = req.body as Partial<ProductFormData> & { saveMode?: SaveMode };
    const isDraft = body?.saveMode === 'draft';

    if (!isDraft && (!body || typeof body.name !== 'string' || !body.name.trim())) {
      res.status(400).json({ error: 'Tên sản phẩm không được để trống.' });
      return;
    }

    const products = ensureStore();
    const now = new Date().toISOString();
    const id = `dx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sanitized = sanitizeFormData(body);

    const newProduct: Product = {
      id,
      ...sanitized,
      code: sanitized.code || generateNextCode(products),
      name: sanitized.name || 'Sản phẩm nháp chưa đặt tên',
      isDraft,
      draftData: null,
      draftUpdatedAt: isDraft ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newProduct, ...products];
    writeStore(updated);
    res.status(201).json(newProduct);
  });

  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<ProductFormData> & { saveMode?: SaveMode };
    const products = ensureStore();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }

    const existing = products[index];
    const now = new Date().toISOString();
    const saveMode: SaveMode = body?.saveMode || 'publish';

    // Discard pending draft on a published product
    if (saveMode === 'discard-draft') {
      const updatedProduct: Product = {
        ...existing,
        draftData: null,
        draftUpdatedAt: null,
      };
      products[index] = updatedProduct;
      writeStore(products);
      res.json(updatedProduct);
      return;
    }

    // Save as draft during update
    if (saveMode === 'draft') {
      if (existing.isDraft) {
        // Record itself is still a draft -> update it directly as draft
        const sanitized = sanitizeFormData(body, existing);
        const updatedDraft: Product = {
          ...existing,
          ...sanitized,
          code: sanitized.code || existing.code,
          name: sanitized.name || 'Sản phẩm nháp chưa đặt tên',
          isDraft: true,
          draftData: null,
          draftUpdatedAt: now,
          updatedAt: now,
        };
        products[index] = updatedDraft;
        writeStore(products);
        res.json(updatedDraft);
        return;
      } else {
        // Record is already published -> store edits inside draftData without overwriting published view
        const draftPayload = sanitizeFormData(body, existing.draftData ?? existing);
        draftPayload.code = draftPayload.code || existing.code;
        draftPayload.name = draftPayload.name || existing.name;
        const updatedWithDraft: Product = {
          ...existing,
          draftData: draftPayload,
          draftUpdatedAt: now,
        };
        products[index] = updatedWithDraft;
        writeStore(products);
        res.json(updatedWithDraft);
        return;
      }
    }

    // Publish / official update
    const nextStatus = body.status ?? existing.status;
    let nextHistory = existing.statusHistory;
    if (Array.isArray(body.statusHistory) && body.statusHistory.length > 0) {
      nextHistory = [...body.statusHistory].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    } else if (body.status && body.status !== existing.status) {
      const ts = body.statusUpdatedAt || now;
      const existingIdx = existing.statusHistory.findIndex((h) => h.status === body.status);
      if (existingIdx >= 0) {
        nextHistory = existing.statusHistory.map((h, i) =>
          i === existingIdx ? { ...h, updatedAt: ts } : h
        );
      } else {
        nextHistory = [
          ...existing.statusHistory,
          { id: `sh-${Date.now()}`, status: body.status, updatedAt: ts },
        ];
      }
      nextHistory = [...nextHistory].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    }

    const nextStatusUpdatedAt =
      body.statusUpdatedAt ??
      (body.status && body.status !== existing.status ? now : existing.statusUpdatedAt);

    const sanitized = sanitizeFormData(
      {
        ...body,
        status: nextStatus,
        statusUpdatedAt: nextStatusUpdatedAt,
        statusHistory: nextHistory,
      },
      existing
    );

    if (!sanitized.name) {
      res.status(400).json({ error: 'Tên sản phẩm không được để trống.' });
      return;
    }

    const updatedProduct: Product = {
      ...existing,
      ...sanitized,
      code: sanitized.code || existing.code,
      isDraft: false,
      draftData: null,
      draftUpdatedAt: null,
      updatedAt: now,
    };

    products[index] = updatedProduct;
    writeStore(products);
    res.json(updatedProduct);
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const products = ensureStore();
    const filtered = products.filter((p) => p.id !== id);
    if (filtered.length === products.length) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm để xóa.' });
      return;
    }
    writeStore(filtered);

    const tasks = ensureTasksStore();
    const remainingTasks = tasks.filter((t) => t.productId !== id);
    if (remainingTasks.length !== tasks.length) {
      writeTasksStore(remainingTasks);
    }

    res.json({ deleted: true, id });
  });

  app.post('/api/products/reset', (_req, res) => {
    const fresh = [...SEED_PRODUCTS];
    writeStore(fresh);
    const freshTasks = [...SEED_DEPLOYMENT_TASKS];
    writeTasksStore(freshTasks);
    res.json(fresh);
  });

  // Deployment Tasks API
  app.get('/api/deployment-tasks', (_req, res) => {
    const tasks = ensureTasksStore();
    res.json(tasks);
  });

  app.post('/api/deployment-tasks', (req, res) => {
    const payload = req.body as Partial<DeploymentTaskFormData>;
    if (!payload || !payload.productId || !payload.subTask?.trim()) {
      res.status(400).json({ error: 'Vui lòng chọn sản phẩm và nhập Đầu việc con.' });
      return;
    }

    const tasks = ensureTasksStore();
    const now = new Date().toISOString();
    const status = payload.status || 'New';
    const progressNum =
      status === 'Done'
        ? 100
        : Math.max(0, Math.min(100, Number(payload.progress ?? 0) || 0));

    const newTask: DeploymentTask = {
      id: `dt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: payload.productId,
      parentTask: payload.parentTask?.trim() || 'Đầu việc chung',
      subTask: payload.subTask.trim(),
      pic: payload.pic?.trim() || '',
      collaborators: payload.collaborators?.trim() || '',
      startDate: payload.startDate || now.slice(0, 10),
      endDate: payload.endDate || now.slice(0, 10),
      output: payload.output?.trim() || '',
      status,
      progress: progressNum,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...tasks, newTask];
    writeTasksStore(updated);
    res.status(201).json(newTask);
  });

  app.put('/api/deployment-tasks/:id', (req, res) => {
    const { id } = req.params;
    const payload = req.body as Partial<DeploymentTaskFormData>;
    const tasks = ensureTasksStore();
    const index = tasks.findIndex((t) => t.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Không tìm thấy đầu việc triển khai.' });
      return;
    }

    const existing = tasks[index];
    const nextStatus = payload.status ?? existing.status;
    let nextProgress =
      payload.progress !== undefined
        ? Math.max(0, Math.min(100, Number(payload.progress) || 0))
        : existing.progress;
    if (payload.status === 'Done' && payload.progress === undefined) {
      nextProgress = 100;
    }

    const updatedTask: DeploymentTask = {
      ...existing,
      productId: payload.productId ?? existing.productId,
      parentTask: payload.parentTask !== undefined ? payload.parentTask.trim() : existing.parentTask,
      subTask: payload.subTask !== undefined ? payload.subTask.trim() : existing.subTask,
      pic: payload.pic !== undefined ? payload.pic.trim() : existing.pic,
      collaborators:
        payload.collaborators !== undefined ? payload.collaborators.trim() : existing.collaborators,
      startDate: payload.startDate ?? existing.startDate,
      endDate: payload.endDate ?? existing.endDate,
      output: payload.output !== undefined ? payload.output.trim() : existing.output,
      status: nextStatus,
      progress: nextProgress,
      updatedAt: new Date().toISOString(),
    };

    tasks[index] = updatedTask;
    writeTasksStore(tasks);
    res.json(updatedTask);
  });

  app.delete('/api/deployment-tasks/:id', (req, res) => {
    const { id } = req.params;
    const tasks = ensureTasksStore();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) {
      res.status(404).json({ error: 'Không tìm thấy đầu việc để xóa.' });
      return;
    }
    writeTasksStore(filtered);
    res.json({ deleted: true, id });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FPT DX Replication Hub server listening on http://localhost:${PORT}`);
  });
}

startServer();
