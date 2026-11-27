import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { TaskComment, UserRole } from '../types';
import { apiRequest } from './apiClient';

export const commentService = {
  async listByTask(taskId: string): Promise<TaskComment[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`*, author:profiles!task_comments_author_id_fkey(full_name, role)`)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => {
        const author = row.author as { full_name?: string; role?: UserRole } | null;
        return {
          id: String(row.id),
          taskId: String(row.task_id),
          authorId: String(row.author_id),
          authorName: author?.full_name ?? 'Unknown',
          authorRole: author?.role ?? 'Member',
          parentId: row.parent_id ? String(row.parent_id) : null,
          body: String(row.body),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        };
      });
    }
    return apiRequest<TaskComment[]>(`/api/tasks/${taskId}/comments`);
  },

  async create(taskId: string, body: string, parentId: string | null = null): Promise<TaskComment> {
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: userData.user.id,
          parent_id: parentId,
          body,
        })
        .select(`*, author:profiles!task_comments_author_id_fkey(full_name, role)`)
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to add comment');
      const author = data.author as { full_name?: string; role?: UserRole } | null;
      return {
        id: String(data.id),
        taskId: String(data.task_id),
        authorId: String(data.author_id),
        authorName: author?.full_name ?? 'Unknown',
        authorRole: author?.role ?? 'Member',
        parentId: data.parent_id ? String(data.parent_id) : null,
        body: String(data.body),
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      };
    }

    return apiRequest<TaskComment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, parentId }),
    });
  },
};
