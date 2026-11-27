import { isSupabaseConfigured } from '../lib/supabase';
import {
  AGING_BUCKETS,
  getTaskAgeHours,
  getTaskAgingBucket,
  getTaskSlaInfo,
  isTaskDueSoon,
  isTaskOverdue,
  type AgingBucket,
  type DimensionCountRow,
  type MonthlySummaryRow,
  type ReportSummary,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserProductivityRow,
  type UserProfile,
} from '../types';
import { apiRequest, getAuthToken } from './apiClient';
import { exportTasksToExcel } from './excelService';
import { taskService } from './taskService';
import { userService } from './userService';

function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildDimensionStats(tasks: Task[], getKey: (t: Task) => string): DimensionCountRow[] {
  const map = new Map<string, DimensionCountRow>();
  for (const t of tasks) {
    const name = getKey(t) || 'Unassigned';
    const row = map.get(name) || {
      name,
      total: 0,
      open: 0,
      completed: 0,
      overdue: 0,
      breached: 0,
    };
    row.total += 1;
    if (t.status === 'Done') row.completed += 1;
    else if (t.status !== 'Cancelled') row.open += 1;
    if (isTaskOverdue(t)) row.overdue += 1;
    if (getTaskSlaInfo(t).status === 'Breached') row.breached += 1;
    map.set(name, row);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function buildReportFromData(tasks: Task[], users: UserProfile[]): ReportSummary {
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((t) => t.status === 'Open').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const reviewTasks = tasks.filter((t) => t.status === 'Review').length;
  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
  const cancelledTasks = tasks.filter((t) => t.status === 'Cancelled').length;
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t)).length;
  const dueSoonTasks = tasks.filter((t) => !isTaskOverdue(t) && isTaskDueSoon(t)).length;

  const denom = totalTasks - cancelledTasks;
  const completionRate = denom > 0 ? Math.round((completedTasks / denom) * 100) : 0;

  let slaOnTrack = 0;
  let slaAtRisk = 0;
  let slaBreached = 0;
  let slaMet = 0;
  for (const t of tasks) {
    const sla = getTaskSlaInfo(t).status;
    if (sla === 'On Track') slaOnTrack += 1;
    else if (sla === 'At Risk') slaAtRisk += 1;
    else if (sla === 'Breached') slaBreached += 1;
    else if (sla === 'Met') slaMet += 1;
  }
  const slaDenom = slaOnTrack + slaAtRisk + slaBreached + slaMet;
  const slaComplianceRate =
    slaDenom > 0 ? Math.round(((slaDenom - slaBreached) / slaDenom) * 100) : 100;

  const activeTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');
  const avgAgeHours =
    activeTasks.length > 0
      ? Math.round(
          activeTasks.reduce((sum, t) => sum + getTaskAgeHours(t), 0) / activeTasks.length
        )
      : 0;

  const byAgingBucket: Array<{ bucket: AgingBucket; count: number }> = AGING_BUCKETS.map(
    (bucket) => ({
      bucket,
      count: activeTasks.filter((t) => getTaskAgingBucket(t) === bucket).length,
    })
  );

  const priorities: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
  const byPriority = priorities.map((priority) => ({
    priority,
    count: tasks.filter((t) => t.priority === priority).length,
  }));

  const statuses: TaskStatus[] = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];
  const byStatus = statuses.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));

  const byCategory = buildDimensionStats(tasks, (t) => t.category);
  const byArea = buildDimensionStats(tasks, (t) => t.area);
  const byBranch = buildDimensionStats(tasks, (t) => t.branch);
  const byOutlet = buildDimensionStats(tasks, (t) => t.outlet);

  const assigneeMap = new Map<
    string,
    { assigneeId: string | null; name: string; count: number; overdue: number }
  >();
  for (const t of tasks) {
    const key = t.assigneeId || 'unassigned';
    const entry = assigneeMap.get(key) || {
      assigneeId: t.assigneeId,
      name: t.assigneeName ?? 'Unassigned',
      count: 0,
      overdue: 0,
    };
    entry.count += 1;
    if (isTaskOverdue(t)) entry.overdue += 1;
    assigneeMap.set(key, entry);
  }
  const byAssignee = Array.from(assigneeMap.values()).sort((a, b) => b.count - a.count);

  const userProductivity: UserProductivityRow[] = users
    .map((u) => {
      const owned = tasks.filter((t) => t.assigneeId === u.id && t.status !== 'Cancelled');
      const assigned = owned.length;
      const completed = owned.filter((t) => t.status === 'Done').length;
      const inProgress = owned.filter(
        (t) => t.status === 'In Progress' || t.status === 'Review'
      ).length;
      const overdue = owned.filter((t) => isTaskOverdue(t)).length;
      const slaEvaluated = owned.length;
      const slaMetCount = owned.filter((t) => getTaskSlaInfo(t).status !== 'Breached').length;
      const slaCompliance =
        slaEvaluated > 0 ? Math.round((slaMetCount / slaEvaluated) * 100) : 100;
      const avgUserAge =
        owned.length > 0
          ? Math.round(owned.reduce((s, t) => s + getTaskAgeHours(t), 0) / owned.length)
          : 0;
      const completionRateVal = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      const productivityScore =
        assigned > 0
          ? Math.max(0, Math.round(completionRateVal * 0.55 + slaCompliance * 0.45 - overdue * 5))
          : 0;

      return {
        userId: u.id,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        area: u.area,
        branch: u.branch,
        assigned,
        completed,
        inProgress,
        overdue,
        slaMet: slaMetCount,
        slaEvaluated,
        slaComplianceRate: slaCompliance,
        avgAgeHours: avgUserAge,
        completionRate: completionRateVal,
        productivityScore,
      };
    })
    .sort((a, b) => b.productivityScore - a.productivityScore || b.completed - a.completed);

  const monthlySummary: MonthlySummaryRow[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const created = tasks.filter((t) => t.createdAt.slice(0, 7) === ym).length;
    const completed = tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 7) === ym).length;
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate.slice(0, 7) === ym && isTaskOverdue(t)
    ).length;
    monthlySummary.push({ month: ym, label, created, completed, overdue });
  }

  return {
    totalTasks,
    openTasks,
    inProgressTasks,
    reviewTasks,
    completedTasks,
    cancelledTasks,
    overdueTasks,
    dueSoonTasks,
    completionRate,
    slaComplianceRate,
    slaOnTrack,
    slaAtRisk,
    slaBreached,
    slaMet,
    avgAgeHours,
    byPriority,
    byStatus,
    byAgingBucket,
    byCategory,
    byArea,
    byBranch,
    byOutlet,
    byAssignee,
    userProductivity,
    monthlySummary,
  };
}

export const reportService = {
  async getSummary(): Promise<ReportSummary> {
    if (isSupabaseConfigured) {
      const [tasks, users] = await Promise.all([taskService.list(), userService.list()]);
      return buildReportFromData(tasks, users);
    }
    return apiRequest<ReportSummary>('/api/reports/summary');
  },

  async exportExcel(tasksFallback?: Task[]): Promise<void> {
    if (isSupabaseConfigured || tasksFallback) {
      const list = tasksFallback ?? (await taskService.list());
      await exportTasksToExcel(list);
      return;
    }

    const token = getAuthToken();
    const res = await fetch('/api/reports/export.xlsx', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Excel export failed.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opex-tasks-export.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async exportCsv(): Promise<void> {
    if (isSupabaseConfigured) {
      const tasks = await taskService.list();
      const header = [
        'Task Code',
        'Title',
        'Category',
        'Status',
        'Priority',
        'SLA Hours',
        'SLA Status',
        'Age (Days)',
        'Area',
        'Branch',
        'Outlet',
        'Department',
        'Assignee',
        'Created By',
        'Due Date',
        'Completed At',
        'Created At',
      ];
      const rows = tasks.map((t) =>
        [
          t.taskCode,
          t.title,
          t.category,
          t.status,
          t.priority,
          t.slaHours,
          getTaskSlaInfo(t).status,
          Math.floor(getTaskAgeHours(t) / 24),
          t.area,
          t.branch,
          t.outlet,
          t.department,
          t.assigneeName ?? 'Unassigned',
          t.createdByName ?? '',
          t.dueDate ?? '',
          t.completedAt ?? '',
          t.createdAt,
        ]
          .map(csvEscape)
          .join(',')
      );
      const blob = new Blob([[header.map(csvEscape).join(','), ...rows].join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'opex-tasks-report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const token = getAuthToken();
    const res = await fetch('/api/reports/export.csv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('CSV export failed.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opex-tasks-report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
