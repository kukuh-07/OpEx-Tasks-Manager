import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  SLA_HOURS_BY_PRIORITY,
  type CreateTaskInput,
  type Task,
  type TaskActivityLog,
  type UpdateTaskInput,
  type UserRole,
} from '../types';
import { apiRequest } from './apiClient';

function mapSupabaseTask(row: Record<string, unknown>): Task {
  const assignee = row.assignee as { full_name?: string; role?: UserRole } | null;
  const creator = row.creator as { full_name?: string } | null;
  const priority = row.priority as Task['priority'];
  return {
    id: String(row.id),
    taskCode: String(row.task_code),
    title: String(row.title),
    description: String(row.description ?? ''),
    category: String(row.category ?? 'Store Operations'),
    priority,
    status: row.status as Task['status'],
    department: String(row.department ?? 'Operations Control'),
    area: String(row.area ?? 'Region West'),
    branch: String(row.branch ?? 'North Hub Branch'),
    outlet: String(row.outlet ?? 'Outlet 01 - Flagship Plaza'),
    slaHours: Number(row.sla_hours ?? SLA_HOURS_BY_PRIORITY[priority] ?? 72),
    dueDate: row.due_date ? String(row.due_date) : null,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    assigneeName: assignee?.full_name ?? null,
    assigneeRole: assignee?.role ?? null,
    createdBy: String(row.created_by),
    createdByName: creator?.full_name ?? 'Unknown',
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const taskService = {
  async list(): Promise<Task[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `*,
           assignee:profiles!tasks_assignee_id_fkey(full_name, role),
           creator:profiles!tasks_created_by_fkey(full_name)`
        )
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapSupabaseTask(row as Record<string, unknown>));
    }
    return apiRequest<Task[]>('/api/tasks');
  },

  async getById(id: string): Promise<Task> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          `*,
           assignee:profiles!tasks_assignee_id_fkey(full_name, role),
           creator:profiles!tasks_created_by_fkey(full_name)`
        )
        .eq('id', id)
        .single();
      if (error || !data) throw new Error(error?.message || 'Task not found');
      return mapSupabaseTask(data as Record<string, unknown>);
    }
    return apiRequest<Task>(`/api/tasks/${id}`);
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const slaHours = input.slaHours ?? SLA_HOURS_BY_PRIORITY[input.priority] ?? 72;
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: input.status ?? 'Open',
          department: input.department,
          area: input.area,
          branch: input.branch,
          outlet: input.outlet,
          sla_hours: slaHours,
          due_date: input.dueDate,
          assignee_id: input.assigneeId,
          created_by: userData.user.id,
        })
        .select(
          `*,
           assignee:profiles!tasks_assignee_id_fkey(full_name, role),
           creator:profiles!tasks_created_by_fkey(full_name)`
        )
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to create task');
      return mapSupabaseTask(data as Record<string, unknown>);
    }

    return apiRequest<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...input, slaHours }),
    });
  },

  async importBatch(
    rows: CreateTaskInput[],
    fileName = 'excel-import.xlsx'
  ): Promise<{ importedCount: number; tasks: Task[] }> {
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      let batchId: string | null = null;
      const { data: batchRow } = await supabase
        .from('task_import_batches')
        .insert({
          imported_by: userData.user.id,
          file_name: fileName,
          total_rows: rows.length,
          imported_rows: rows.length,
          failed_rows: 0,
          status: 'Completed',
        })
        .select('id')
        .single();
      if (batchRow?.id) {
        batchId = String(batchRow.id);
      }

      const payload = rows.map((input) => ({
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: input.status ?? 'Open',
        department: input.department,
        area: input.area,
        branch: input.branch,
        outlet: input.outlet,
        sla_hours: input.slaHours ?? SLA_HOURS_BY_PRIORITY[input.priority] ?? 72,
        due_date: input.dueDate,
        assignee_id: input.assigneeId,
        created_by: userData.user.id,
        ...(batchId ? { import_batch_id: batchId } : {}),
      }));
      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select(
          `*,
           assignee:profiles!tasks_assignee_id_fkey(full_name, role),
           creator:profiles!tasks_created_by_fkey(full_name)`
        );
      if (error) throw new Error(error.message);
      const tasks = (data ?? []).map((row) => mapSupabaseTask(row as Record<string, unknown>));
      return { importedCount: tasks.length, tasks };
    }

    return apiRequest<{ importedCount: number; tasks: Task[] }>('/api/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    if (isSupabaseConfigured && supabase) {
      const payload: Record<string, unknown> = {};
      if (input.title !== undefined) payload.title = input.title;
      if (input.description !== undefined) payload.description = input.description;
      if (input.category !== undefined) payload.category = input.category;
      if (input.priority !== undefined) payload.priority = input.priority;
      if (input.status !== undefined) payload.status = input.status;
      if (input.department !== undefined) payload.department = input.department;
      if (input.area !== undefined) payload.area = input.area;
      if (input.branch !== undefined) payload.branch = input.branch;
      if (input.outlet !== undefined) payload.outlet = input.outlet;
      if (input.slaHours !== undefined) payload.sla_hours = input.slaHours;
      if (input.dueDate !== undefined) payload.due_date = input.dueDate;
      if (input.assigneeId !== undefined) payload.assignee_id = input.assigneeId;

      const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .select(
          `*,
           assignee:profiles!tasks_assignee_id_fkey(full_name, role),
           creator:profiles!tasks_created_by_fkey(full_name)`
        )
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to update task');
      return mapSupabaseTask(data as Record<string, unknown>);
    }

    return apiRequest<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async remove(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    await apiRequest<{ deleted: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' });
  },

  async getActivity(taskId: string): Promise<TaskActivityLog[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('task_activity_logs')
        .select(`*, actor:profiles!task_activity_logs_actor_id_fkey(full_name)`)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        actorId: row.actor_id ? String(row.actor_id) : null,
        actorName: (row.actor as { full_name?: string } | null)?.full_name ?? 'System',
        action: String(row.action),
        details: (row.details as Record<string, unknown>) ?? {},
        createdAt: String(row.created_at),
      }));
    }
    return apiRequest<TaskActivityLog[]>(`/api/tasks/${taskId}/activity`);
  },
};
