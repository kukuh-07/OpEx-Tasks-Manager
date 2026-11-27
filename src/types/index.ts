export type UserRole = 'Admin' | 'Supervisor' | 'Member';
export type UserStatus = 'Active' | 'Inactive' | 'Suspended';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Open' | 'In Progress' | 'Review' | 'Done' | 'Cancelled';
export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'comment_added'
  | 'due_soon'
  | 'overdue_alert';

export type SlaStatus = 'On Track' | 'At Risk' | 'Breached' | 'Met' | 'Cancelled';
export type AgingBucket = '0-1 Days' | '2-3 Days' | '4-7 Days' | '8+ Days';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  jobTitle: string;
  area: string;
  branch: string;
  outlet: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  department: string;
  area: string;
  branch: string;
  outlet: string;
  slaHours: number;
  dueDate: string | null; // YYYY-MM-DD
  assigneeId: string | null;
  assigneeName?: string | null;
  assigneeRole?: UserRole | null;
  createdBy: string;
  createdByName?: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentCount?: number;
  commentCount?: number;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedBy: string;
  uploadedByName?: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName?: string;
  authorRole?: UserRole;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivityLog {
  id: string;
  taskId: string;
  actorId: string | null;
  actorName?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  taskId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  status?: TaskStatus;
  department: string;
  area: string;
  branch: string;
  outlet: string;
  slaHours?: number;
  dueDate: string | null;
  assigneeId: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  category?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  department?: string;
  area?: string;
  branch?: string;
  outlet?: string;
  slaHours?: number;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export interface UserProductivityRow {
  userId: string;
  fullName: string;
  role: UserRole;
  department: string;
  area: string;
  branch: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  slaMet: number;
  slaEvaluated: number;
  slaComplianceRate: number;
  avgAgeHours: number;
  completionRate: number;
  productivityScore: number;
}

export interface MonthlySummaryRow {
  month: string; // e.g., '2026-11'
  label: string; // e.g., 'Nov 2026'
  created: number;
  completed: number;
  overdue: number;
}

export interface DimensionCountRow {
  name: string;
  total: number;
  open: number;
  completed: number;
  overdue: number;
  breached: number;
}

export interface ReportSummary {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  completedTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  completionRate: number;
  slaComplianceRate: number;
  slaOnTrack: number;
  slaAtRisk: number;
  slaBreached: number;
  slaMet: number;
  avgAgeHours: number;
  byPriority: Array<{ priority: TaskPriority; count: number }>;
  byStatus: Array<{ status: TaskStatus; count: number }>;
  byAgingBucket: Array<{ bucket: AgingBucket; count: number }>;
  byCategory: DimensionCountRow[];
  byArea: DimensionCountRow[];
  byBranch: DimensionCountRow[];
  byOutlet: DimensionCountRow[];
  byAssignee: Array<{ assigneeId: string | null; name: string; count: number; overdue: number }>;
  userProductivity: UserProductivityRow[];
  monthlySummary: MonthlySummaryRow[];
}

export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const TASK_STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];
export const USER_ROLES: UserRole[] = ['Admin', 'Supervisor', 'Member'];
export const USER_STATUSES: UserStatus[] = ['Active', 'Inactive', 'Suspended'];

export const TASK_CATEGORIES: string[] = [
  'Warehouse (WMS)',
  'Trucking (TMS)',
];

export const DEPARTMENTS: string[] = [
  'Operational Exellence (OpEx)',
  ];

export const AREAS: string[] = [
  'Region West',
  'Region Central',
  'Region East',
];

export const BRANCHES: string[] = [
  'MBL',
  'MGM',
];

export const OUTLETS: string[] = [
  'MBS',
  'MBU',
  'MBM',
  'MBP',
  'MBB',
  'SIF-MA',
  'SIF-CIK',
  'MTI-MANADO',
  'MGM',
];

export const SLA_HOURS_BY_PRIORITY: Record<TaskPriority, number> = {
  Critical: 24,
  High: 48,
  Medium: 72,
  Low: 120,
};

export const AGING_BUCKETS: AgingBucket[] = [
  '0-1 Days',
  '2-3 Days',
  '4-7 Days',
  '8+ Days',
];

export function isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'Done' || task.status === 'Cancelled') return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.dueDate < today;
}

export function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  const dueMs = Date.parse(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(todayMs) || Number.isNaN(dueMs)) return null;
  return Math.round((dueMs - todayMs) / 86_400_000);
}

export function isTaskDueSoon(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'Done' || task.status === 'Cancelled') return false;
  const diffDays = getDaysUntilDue(task.dueDate);
  if (diffDays === null) return false;
  return diffDays >= 0 && diffDays <= 2;
}

export function getTaskAgeHours(task: Pick<Task, 'createdAt' | 'completedAt' | 'status'>): number {
  const start = Date.parse(task.createdAt);
  if (Number.isNaN(start)) return 0;
  const end =
    task.status === 'Done' && task.completedAt ? Date.parse(task.completedAt) : Date.now();
  return Math.max(0, (end - start) / 3_600_000);
}

export function getTaskAgeDays(task: Pick<Task, 'createdAt' | 'completedAt' | 'status'>): number {
  return Math.floor(getTaskAgeHours(task) / 24);
}

export function getTaskAgingBucket(task: Pick<Task, 'createdAt' | 'completedAt' | 'status'>): AgingBucket {
  const days = getTaskAgeDays(task);
  if (days <= 1) return '0-1 Days';
  if (days <= 3) return '2-3 Days';
  if (days <= 7) return '4-7 Days';
  return '8+ Days';
}

export function formatTaskAge(ageHours: number): string {
  if (ageHours < 24) {
    return `${Math.max(1, Math.round(ageHours))}h`;
  }
  const days = Math.floor(ageHours / 24);
  const remHours = Math.round(ageHours % 24);
  if (days < 7 && remHours > 0) {
    return `${days}d ${remHours}h`;
  }
  return `${days}d`;
}

export interface TaskSlaInfo {
  status: SlaStatus;
  slaHours: number;
  elapsedHours: number;
  remainingHours: number;
  progressPct: number;
  deadlineIso: string;
}

export function getTaskSlaInfo(
  task: Pick<Task, 'createdAt' | 'completedAt' | 'dueDate' | 'status' | 'priority' | 'slaHours'>
): TaskSlaInfo {
  const slaHours = Math.max(1, task.slaHours || SLA_HOURS_BY_PRIORITY[task.priority] || 72);
  const createdMs = Date.parse(task.createdAt);
  const validCreated = Number.isNaN(createdMs) ? Date.now() : createdMs;
  const slaDeadlineMs = validCreated + slaHours * 3_600_000;
  const deadlineIso = new Date(slaDeadlineMs).toISOString();

  if (task.status === 'Cancelled') {
    return {
      status: 'Cancelled',
      slaHours,
      elapsedHours: 0,
      remainingHours: 0,
      progressPct: 0,
      deadlineIso,
    };
  }

  const endMs =
    task.status === 'Done' && task.completedAt ? Date.parse(task.completedAt) : Date.now();
  const elapsedHours = Math.max(0, (endMs - validCreated) / 3_600_000);
  const remainingHours = (slaDeadlineMs - endMs) / 3_600_000;
  const progressPct = Math.min(100, Math.round((elapsedHours / slaHours) * 100));

  if (task.status === 'Done') {
    const overdueAtCompletion =
      task.dueDate && task.completedAt ? task.completedAt.slice(0, 10) > task.dueDate : false;
    const breached = elapsedHours > slaHours || overdueAtCompletion;
    return {
      status: breached ? 'Breached' : 'Met',
      slaHours,
      elapsedHours,
      remainingHours,
      progressPct: Math.min(100, progressPct),
      deadlineIso,
    };
  }

  const overdue = isTaskOverdue(task);
  const dueSoon = isTaskDueSoon(task);

  if (overdue || elapsedHours > slaHours) {
    return {
      status: 'Breached',
      slaHours,
      elapsedHours,
      remainingHours,
      progressPct: 100,
      deadlineIso,
    };
  }

  if (dueSoon || progressPct >= 75) {
    return {
      status: 'At Risk',
      slaHours,
      elapsedHours,
      remainingHours,
      progressPct,
      deadlineIso,
    };
  }

  return {
    status: 'On Track',
    slaHours,
    elapsedHours,
    remainingHours,
    progressPct,
    deadlineIso,
  };
}

export function canUserEditTask(user: UserProfile | null, task: Task): boolean {
  if (!user || user.status !== 'Active') return false;
  if (user.role === 'Admin' || user.role === 'Supervisor') return true;
  return task.assigneeId === user.id || task.createdBy === user.id;
}

export function canUserDeleteTask(user: UserProfile | null, task: Task): boolean {
  if (!user || user.status !== 'Active') return false;
  if (user.role === 'Admin') return true;
  if (user.role === 'Supervisor' && task.createdBy === user.id) return true;
  return false;
}

export function canUserAssignTask(user: UserProfile | null): boolean {
  if (!user || user.status !== 'Active') return false;
  return user.role === 'Admin' || user.role === 'Supervisor';
}

export function canUserManageUsers(user: UserProfile | null): boolean {
  if (!user || user.status !== 'Active') return false;
  return user.role === 'Admin';
}
