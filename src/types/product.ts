export const PRODUCT_STATUSES = [
  'Đánh giá sơ bộ',
  'Đánh giá chi tiết',
  'Đang trình phê duyệt chủ trương',
  'Đã được duyệt chủ trương',
  'Đang lên kế hoạch chi tiết',
  'Đang triển khai',
  'Đã golive',
  'Theo dõi vận hành',
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const REPLICATION_MODES = ['GO-P', 'GO-C', 'GO-M', 'NO-GO'] as const;

export type ReplicationMode = (typeof REPLICATION_MODES)[number];

export const REPLICABILITY_OPTIONS = ['Có', 'Không'] as const;

export type ReplicabilityOption = (typeof REPLICABILITY_OPTIONS)[number];

export interface ProductLink {
  id: string;
  title: string;
  url: string;
  category?: string;
}

export interface StatusHistoryEntry {
  id: string;
  status: ProductStatus;
  updatedAt: string;
  note?: string;
}

export interface ProductFormData {
  code: string;
  name: string;
  status: ProductStatus;
  statusUpdatedAt: string;
  statusHistory: StatusHistoryEntry[];
  source: string;
  governingUnit: string;
  implementingUnit: string;
  deploymentScope: string;
  isReplicable: ReplicabilityOption;
  replicationMode: ReplicationMode;
  nonReplicableReason: string;
  links: ProductLink[];
  description?: string;
}

export type SaveMode = 'draft' | 'publish' | 'discard-draft';

export interface Product extends ProductFormData {
  id: string;
  isDraft?: boolean;
  draftData?: ProductFormData | null;
  draftUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TASK_STATUSES = ['New', 'In-progress', 'Done'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskHealth = 'Đúng tiến độ' | 'Chậm';

export interface DeploymentTask {
  id: string;
  productId: string;
  parentTask: string;
  subTask: string;
  pic: string;
  collaborators: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  output: string;
  status: TaskStatus;
  progress: number; // 0 - 100
  createdAt: string;
  updatedAt: string;
}

export type DeploymentTaskFormData = Omit<DeploymentTask, 'id' | 'createdAt' | 'updatedAt'>;

export const REPLICATION_MODE_META: Record<
  ReplicationMode,
  { label: string; shortLabel: string; description: string; color: string; bgTint: string; textClass: string }
> = {
  'GO-P': {
    label: 'GO-P (Productize)',
    shortLabel: 'Đóng gói sản phẩm',
    description: 'Đóng gói thành sản phẩm chuẩn hóa, triển khai đa đơn vị hoặc thương mại hóa.',
    color: '#005AAB',
    bgTint: 'bg-sky-50 border-sky-200',
    textClass: 'text-sky-800',
  },
  'GO-C': {
    label: 'GO-C (Customize)',
    shortLabel: 'Tùy biến triển khai',
    description: 'Nhân rộng theo mô hình giải pháp lõi kết hợp tùy biến theo nghiệp vụ đơn vị.',
    color: '#F37021',
    bgTint: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-800',
  },
  'GO-M': {
    label: 'GO-M (Merge / Ecosystem)',
    shortLabel: 'Tích hợp hệ sinh thái',
    description: 'Tích hợp vào nền tảng dùng chung của Tập đoàn (myFPT, FPT Cloud, SPro).',
    color: '#00A651',
    bgTint: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-800',
  },
  'NO-GO': {
    label: 'NO-GO (Không nhân rộng)',
    shortLabel: 'Dừng nhân rộng',
    description: 'Không đáp ứng tiêu chí kỹ thuật, hiệu quả đầu tư (ROI) hoặc trùng lặp nền tảng.',
    color: '#DC2626',
    bgTint: 'bg-red-50 border-red-200',
    textClass: 'text-red-700',
  },
};

export const STATUS_META: Record<
  ProductStatus,
  { step: number; group: 'Đánh giá' | 'Phê duyệt & Kế hoạch' | 'Triển khai' | 'Vận hành'; barColor: string; textClass: string }
> = {
  'Đánh giá sơ bộ': {
    step: 1,
    group: 'Đánh giá',
    barColor: '#64748B',
    textClass: 'text-slate-700',
  },
  'Đánh giá chi tiết': {
    step: 2,
    group: 'Đánh giá',
    barColor: '#475569',
    textClass: 'text-slate-800',
  },
  'Đang trình phê duyệt chủ trương': {
    step: 3,
    group: 'Phê duyệt & Kế hoạch',
    barColor: '#D97706',
    textClass: 'text-amber-700',
  },
  'Đã được duyệt chủ trương': {
    step: 4,
    group: 'Phê duyệt & Kế hoạch',
    barColor: '#0284C7',
    textClass: 'text-sky-700',
  },
  'Đang lên kế hoạch chi tiết': {
    step: 5,
    group: 'Phê duyệt & Kế hoạch',
    barColor: '#005AAB',
    textClass: 'text-blue-800',
  },
  'Đang triển khai': {
    step: 6,
    group: 'Triển khai',
    barColor: '#F37021',
    textClass: 'text-orange-700',
  },
  'Đã golive': {
    step: 7,
    group: 'Vận hành',
    barColor: '#16A34A',
    textClass: 'text-emerald-700',
  },
  'Theo dõi vận hành': {
    step: 8,
    group: 'Vận hành',
    barColor: '#00A651',
    textClass: 'text-emerald-800',
  },
};

export const FPT_UNIT_SUGGESTIONS = [
  'Ban Chuyển đổi số Tập đoàn (FDX)',
  'FPT Software',
  'FPT IS',
  'FPT Telecom',
  'FPT Smart Cloud',
  'FPT Digital',
  'FPT Retail (Long Châu / FPT Shop)',
  'FPT Education',
  'FPT Online',
  'Base Enterprise',
  'Synnex FPT',
  'Ban CNTT Tập đoàn (FIM)',
];

export const PRODUCT_SOURCE_SUGGESTIONS = [
  'FPT Smart Cloud',
  'FPT Software DX Garage',
  'FPT IS',
  'FPT Telecom',
  'FPT Digital',
  'Base Enterprise',
  'Nội bộ CTTV đề xuất',
  'Liên doanh & Đối tác công nghệ',
];
