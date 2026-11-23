
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { WorkflowService } from './src/server/workflowService.ts';

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

const PORT = Number(process.env.PORT) || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong file .env'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// --------------------------------------------------
// Database mapping: camelCase <-> snake_case
// --------------------------------------------------

function productFromDb(row: any): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    statusHistory: row.status_history ?? [],
    source: row.source ?? '',
    governingUnit: row.governing_unit ?? '',
    implementingUnit: row.implementing_unit ?? '',
    deploymentScope: row.deployment_scope ?? '',
    isReplicable: row.is_replicable ?? 'Có',
    replicationMode: row.replication_mode ?? 'GO-P',
    nonReplicableReason: row.non_replicable_reason ?? '',
    links: row.links ?? [],
    description: row.description ?? '',
    isDraft: Boolean(row.is_draft),
    draftData: row.draft_data ?? null,
    draftUpdatedAt: row.draft_updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function productToDb(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    status: product.status,
    status_updated_at: product.statusUpdatedAt,
    status_history: product.statusHistory,
    source: product.source,
    governing_unit: product.governingUnit,
    implementing_unit: product.implementingUnit,
    deployment_scope: product.deploymentScope,
    is_replicable: product.isReplicable,
    replication_mode: product.replicationMode,
    non_replicable_reason: product.nonReplicableReason,
    links: product.links,
    description: product.description,
    is_draft: product.isDraft ?? false,
    draft_data: product.draftData ?? null,
    draft_updated_at: product.draftUpdatedAt ?? null,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

function taskFromDb(row: any): DeploymentTask {
  return {
    id: row.id,
    productId: row.product_id,
    parentTask: row.parent_task ?? '',
    subTask: row.sub_task ?? '',
    pic: row.pic ?? '',
    collaborators: row.collaborators ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
    output: row.output ?? '',
    status: row.status,
    progress: Number(row.progress ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToDb(task: DeploymentTask): Record<string, unknown> {
  return {
    id: task.id,
    product_id: task.productId,
    parent_task: task.parentTask,
    sub_task: task.subTask,
    pic: task.pic,
    collaborators: task.collaborators,
    start_date: task.startDate,
    end_date: task.endDate,
    output: task.output,
    status: task.status,
    progress: task.progress,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

// --------------------------------------------------
// Database helpers
// --------------------------------------------------

async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(productFromDb);
}

async function getTasks(): Promise<DeploymentTask[]> {
  const { data, error } = await supabase
    .from('deployment_tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(taskFromDb);
}

async function insertProducts(products: Product[]): Promise<void> {
  if (products.length === 0) return;

  const { error } = await supabase
    .from('products')
    .insert(products.map(productToDb));

  if (error) throw error;
}

async function insertTasks(tasks: DeploymentTask[]): Promise<void> {
  if (tasks.length === 0) return;

  const { error } = await supabase
    .from('deployment_tasks')
    .insert(tasks.map(taskToDb));

  if (error) throw error;
}

// Chỉ nạp seed khi bảng tương ứng đang trống.
// Không ghi đè dữ liệu đã có trong Supabase.
async function initializeDatabase(): Promise<void> {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .limit(1);

  if (productsError) throw productsError;

  if (!products || products.length === 0) {
    console.log('Supabase: products đang trống, bắt đầu nạp seed...');
    await insertProducts(
      SEED_PRODUCTS.map((product) => ({
        ...product,
        isDraft: product.isDraft ?? false,
        draftData: product.draftData ?? null,
        draftUpdatedAt: product.draftUpdatedAt ?? null,
      }))
    );
    console.log(`Đã nạp ${SEED_PRODUCTS.length} products.`);
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('deployment_tasks')
    .select('id')
    .limit(1);

  if (tasksError) throw tasksError;

  if (!tasks || tasks.length === 0) {
    console.log('Supabase: deployment_tasks đang trống, bắt đầu nạp seed...');
    await insertTasks(SEED_DEPLOYMENT_TASKS);
    console.log(`Đã nạp ${SEED_DEPLOYMENT_TASKS.length} deployment tasks.`);
  }
}

// --------------------------------------------------
// Business helpers
// --------------------------------------------------

function generateNextCode(products: Product[]): string {
  let maxNum = 0;

  for (const product of products) {
    const match = /^DX-(\d+)$/i.exec(product.code.trim());
    if (match) {
      maxNum = Math.max(maxNum, Number(match[1]));
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
  const statusUpdatedAt =
    payload.statusUpdatedAt ?? fallback.statusUpdatedAt ?? now;

  const statusHistory =
    Array.isArray(payload.statusHistory) && payload.statusHistory.length > 0
      ? [...payload.statusHistory].sort((a, b) =>
          a.updatedAt.localeCompare(b.updatedAt)
        )
      : Array.isArray(fallback.statusHistory) &&
          fallback.statusHistory.length > 0
        ? fallback.statusHistory
        : [{ id: `sh-${Date.now()}`, status, updatedAt: statusUpdatedAt }];

  const isReplicable =
    payload.isReplicable !== undefined
      ? payload.isReplicable === 'Không'
        ? 'Không'
        : 'Có'
      : fallback.isReplicable ?? 'Có';

  return {
    code: payload.code !== undefined
      ? payload.code.trim()
      : fallback.code || '',
    name: payload.name !== undefined
      ? payload.name.trim()
      : fallback.name || '',
    status,
    statusUpdatedAt,
    statusHistory,
    source: payload.source !== undefined
      ? payload.source.trim()
      : fallback.source || '',
    governingUnit: payload.governingUnit !== undefined
      ? payload.governingUnit.trim()
      : fallback.governingUnit || '',
    implementingUnit: payload.implementingUnit !== undefined
      ? payload.implementingUnit.trim()
      : fallback.implementingUnit || '',
    deploymentScope: payload.deploymentScope !== undefined
      ? payload.deploymentScope.trim()
      : fallback.deploymentScope || '',
    isReplicable,
    replicationMode:
      payload.replicationMode ??
      fallback.replicationMode ??
      (isReplicable === 'Không' ? 'NO-GO' : 'GO-P'),
    nonReplicableReason: payload.nonReplicableReason !== undefined
      ? payload.nonReplicableReason.trim()
      : fallback.nonReplicableReason || '',
    links: Array.isArray(payload.links)
      ? payload.links.filter(
          (link) =>
            link &&
            typeof link.url === 'string' &&
            link.url.trim().length > 0
        )
      : fallback.links || [],
    description: payload.description !== undefined
      ? payload.description.trim()
      : fallback.description || '',
  };
}

// Express async handler: chuyển lỗi Promise sang middleware xử lý lỗi.
function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

// --------------------------------------------------
// Server
// --------------------------------------------------

async function startServer() {
  const app = express();

  const workflowService = new WorkflowService(supabase);

  app.use(express.json({ limit: '2mb' }));

  // Kiểm tra kết nối Supabase và khởi tạo seed nếu DB trống.
  await initializeDatabase();

  app.get('/api/health', asyncHandler(async (_req, res) => {
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (error) throw error;

    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }));

  // ------------------------------------------------
  // Products API
  // ------------------------------------------------

  app.get('/api/products', asyncHandler(async (_req, res) => {
    res.json(await getProducts());
  }));

  app.post('/api/products', asyncHandler(async (req, res) => {
    const body = req.body as Partial<ProductFormData> & {
      saveMode?: SaveMode;
    };

    const isDraft = body?.saveMode === 'draft';

    if (!isDraft && (!body || typeof body.name !== 'string' || !body.name.trim())) {
      res.status(400).json({ error: 'Tên sản phẩm không được để trống.' });
      return;
    }

    const products = await getProducts();
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

    const { error } = await supabase
      .from('products')
      .insert(productToDb(newProduct));

    if (error) throw error;

    res.status(201).json(newProduct);
  }));

  app.put('/api/products/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<ProductFormData> & {
      saveMode?: SaveMode;
    };

    const { data, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!data) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }

    const existing = productFromDb(data);
    const now = new Date().toISOString();
    const saveMode: SaveMode = body?.saveMode || 'publish';

    // Hủy bản nháp.
    if (saveMode === 'discard-draft') {
      const updatedProduct: Product = {
        ...existing,
        draftData: null,
        draftUpdatedAt: null,
      };

      const { error } = await supabase
        .from('products')
        .update({
          draft_data: null,
          draft_updated_at: null,
        })
        .eq('id', id);

      if (error) throw error;

      res.json(updatedProduct);
      return;
    }

    // Lưu bản nháp.
    if (saveMode === 'draft') {
      if (existing.isDraft) {
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

        const { error } = await supabase
          .from('products')
          .update(productToDb(updatedDraft))
          .eq('id', id);

        if (error) throw error;

        res.json(updatedDraft);
        return;
      }

      // Sản phẩm đã công bố: lưu nội dung chỉnh sửa vào draft_data.
      const draftPayload = sanitizeFormData(
        body,
        existing.draftData ?? existing
      );

      draftPayload.code = draftPayload.code || existing.code;
      draftPayload.name = draftPayload.name || existing.name;

      const updatedWithDraft: Product = {
        ...existing,
        draftData: draftPayload,
        draftUpdatedAt: now,
      };

      const { error } = await supabase
        .from('products')
        .update({
          draft_data: draftPayload,
          draft_updated_at: now,
        })
        .eq('id', id);

      if (error) throw error;

      res.json(updatedWithDraft);
      return;
    }

    // Công bố / cập nhật chính thức.
    const nextStatus = body.status ?? existing.status;
    let nextHistory = existing.statusHistory;

    if (Array.isArray(body.statusHistory) && body.statusHistory.length > 0) {
      nextHistory = [...body.statusHistory].sort((a, b) =>
        a.updatedAt.localeCompare(b.updatedAt)
      );
    } else if (body.status && body.status !== existing.status) {
      const ts = body.statusUpdatedAt || now;
      const existingIdx = existing.statusHistory.findIndex(
        (item) => item.status === body.status
      );

      if (existingIdx >= 0) {
        nextHistory = existing.statusHistory.map((item, index) =>
          index === existingIdx ? { ...item, updatedAt: ts } : item
        );
      } else {
        nextHistory = [
          ...existing.statusHistory,
          {
            id: `sh-${Date.now()}`,
            status: body.status,
            updatedAt: ts,
          },
        ];
      }

      nextHistory = [...nextHistory].sort((a, b) =>
        a.updatedAt.localeCompare(b.updatedAt)
      );
    }

    const nextStatusUpdatedAt =
      body.statusUpdatedAt ??
      (body.status && body.status !== existing.status
        ? now
        : existing.statusUpdatedAt);

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

    const { error } = await supabase
      .from('products')
      .update(productToDb(updatedProduct))
      .eq('id', id);

    if (error) throw error;

    res.json(updatedProduct);
  }));

  
app.delete('/api/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Xóa các đầu việc liên quan trước.
  const { error: taskError } = await supabase
    .from('deployment_tasks')
    .delete()
    .eq('product_id', id);

  if (taskError) throw taskError;

  // Sau đó xóa sản phẩm.
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;

  if (!data || data.length === 0) {
    res.status(404).json({
      error: 'Không tìm thấy sản phẩm để xóa.',
    });
    return;
  }

  res.json({ deleted: true, id });
}));

  app.post('/api/products/reset', asyncHandler(async (_req, res) => {
    // Xóa tasks trước để tránh lỗi khóa ngoại.
    const { error: taskDeleteError } = await supabase
      .from('deployment_tasks')
      .delete()
      .neq('id', '');

    if (taskDeleteError) throw taskDeleteError;

    const { error: productDeleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '');

    if (productDeleteError) throw productDeleteError;

    await insertProducts(SEED_PRODUCTS);
    await insertTasks(SEED_DEPLOYMENT_TASKS);

    res.json(SEED_PRODUCTS);
  }));
  // ------------------------------------------------
  // Replication Assessment API
  // ------------------------------------------------

  app.get(
    '/api/assessment-cases/:caseCode',
    asyncHandler(async (req, res) => {
      const { caseCode } = req.params;

      // 1. Lấy assessment case
      const { data: assessmentCase, error: caseError } = await supabase
        .from('assessment_cases')
        .select('*')
        .eq('case_code', caseCode)
        .maybeSingle();

      if (caseError) throw caseError;

      if (!assessmentCase) {
        res.status(404).json({
          error: 'Không tìm thấy hồ sơ đánh giá.',
        });
        return;
      }

      // 2. Lấy các Gate của case
      const { data: gates, error: gatesError } = await supabase
        .from('case_gates')
        .select(
          'id, gate_code, status, decision, confirmed_by, confirmed_at, comment'
        )
        .eq('case_id', assessmentCase.id)
        .order('gate_code', { ascending: true });

      if (gatesError) throw gatesError;

      // 3. Trả snapshot của workflow
      res.json({
        id: assessmentCase.id,
        case_code: assessmentCase.case_code,
        product_id: assessmentCase.product_id,
        scope: assessmentCase.scope,

        current_step: assessmentCase.current_step,
        status: assessmentCase.status,

        assessor: assessmentCase.assessor,
        reviewer: assessmentCase.reviewer,

        calculated_go: assessmentCase.calculated_go,
        approved_go: assessmentCase.approved_go,

        criteria_version: assessmentCase.criteria_version,
        gate_logic_version: assessmentCase.gate_logic_version,
        workflow_version: assessmentCase.workflow_version,
        assessment_version: assessmentCase.assessment_version,

        gates: gates ?? [],

        created_at: assessmentCase.created_at,
        updated_at: assessmentCase.updated_at,
      });
    })
  );
    app.post(
    '/api/assessment-cases/:caseCode/gates/:gateCode/confirm',
    asyncHandler(async (req, res) => {
      const { caseCode, gateCode } = req.params;

      const confirmedBy =
        typeof req.body?.confirmedBy === 'string'
          ? req.body.confirmedBy.trim()
          : '';

      const comment =
        typeof req.body?.comment === 'string'
          ? req.body.comment.trim()
          : undefined;

      if (!confirmedBy) {
        res.status(400).json({
          error: 'Thiếu người xác nhận.',
        });
        return;
      }

      try {
        const result = await workflowService.confirmGate(
          caseCode,
          gateCode,
          confirmedBy,
          comment
        );

        res.json(result);
      } catch (error: any) {
        const knownErrors: Record<string, string> = {
          CASE_NOT_FOUND: 'Không tìm thấy hồ sơ đánh giá.',
          GATE_NOT_FOUND: 'Không tìm thấy Gate.',
          GATE_NOT_PENDING: 'Gate không ở trạng thái chờ xác nhận.',
          INVALID_WORKFLOW_STEP:
            'Không thể xác nhận Gate ở bước workflow hiện tại.',
          UNSUPPORTED_GATE:
            'Gate này chưa được hỗ trợ trong MVP.',
          REVIEWER_MUST_DIFFER_FROM_ASSESSOR:
            'Reviewer phải khác Assessor.',
        };

        const message = knownErrors[error?.message];

        if (message) {
          res.status(400).json({
            error: message,
            code: error.message,
          });
          return;
        }

        throw error;
      }
    })
  );
    // TEST ONLY - sẽ xóa sau khi kiểm thử G1
  app.get(
    '/api/test/confirm-g1',
    asyncHandler(async (_req, res) => {
      const result = await workflowService.confirmGate(
        'IR-MVP-001',
        'G1',
        'Trang Nguyen Thi Thu',
        'Test G1 confirmation from staging'
      );

      res.json(result);
    })
  );
  // ------------------------------------------------
  // Deployment Tasks API
  // ------------------------------------------------

  app.get('/api/deployment-tasks', asyncHandler(async (_req, res) => {
    res.json(await getTasks());
  }));

  app.post('/api/deployment-tasks', asyncHandler(async (req, res) => {
    const payload = req.body as Partial<DeploymentTaskFormData>;

    if (!payload || !payload.productId || !payload.subTask?.trim()) {
      res.status(400).json({
        error: 'Vui lòng chọn sản phẩm và nhập Đầu việc con.',
      });
      return;
    }

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

    const { error } = await supabase
      .from('deployment_tasks')
      .insert(taskToDb(newTask));

    if (error) throw error;

    res.status(201).json(newTask);
  }));

  app.put('/api/deployment-tasks/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payload = req.body as Partial<DeploymentTaskFormData>;

    const { data, error: findError } = await supabase
      .from('deployment_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!data) {
      res.status(404).json({
        error: 'Không tìm thấy đầu việc triển khai.',
      });
      return;
    }

    const existing = taskFromDb(data);
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
      parentTask: payload.parentTask !== undefined
        ? payload.parentTask.trim()
        : existing.parentTask,
      subTask: payload.subTask !== undefined
        ? payload.subTask.trim()
        : existing.subTask,
      pic: payload.pic !== undefined
        ? payload.pic.trim()
        : existing.pic,
      collaborators: payload.collaborators !== undefined
        ? payload.collaborators.trim()
        : existing.collaborators,
      startDate: payload.startDate ?? existing.startDate,
      endDate: payload.endDate ?? existing.endDate,
      output: payload.output !== undefined
        ? payload.output.trim()
        : existing.output,
      status: nextStatus,
      progress: nextProgress,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('deployment_tasks')
      .update(taskToDb(updatedTask))
      .eq('id', id);

    if (error) throw error;

    res.json(updatedTask);
  }));

  app.delete('/api/deployment-tasks/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('deployment_tasks')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      res.status(404).json({
        error: 'Không tìm thấy đầu việc để xóa.',
      });
      return;
    }

    res.json({ deleted: true, id });
  }));

  // ------------------------------------------------
  // Error handling
  // ------------------------------------------------

  app.use((
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error('API error:', err);

    res.status(500).json({
      error: 'Đã xảy ra lỗi khi xử lý dữ liệu.',
      details:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined,
    });
  });

  // ------------------------------------------------
  // Vite / Production frontend
  // ------------------------------------------------

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
    console.log(
      `FPT DX Replication Hub server listening on port ${PORT}`
    );
  });
}

startServer().catch((error) => {
  console.error('Không thể khởi động server:', error);
  process.exit(1);
});
