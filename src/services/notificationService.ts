import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AppNotification, NotificationType } from '../types';
import { apiRequest } from './apiClient';

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.user_id),
        taskId: row.task_id ? String(row.task_id) : null,
        type: row.type as NotificationType,
        title: String(row.title),
        message: String(row.message),
        isRead: Boolean(row.is_read),
        createdAt: String(row.created_at),
      }));
    }
    return apiRequest<AppNotification[]>('/api/notifications');
  },

  async markRead(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userData.user.id)
        .eq('is_read', false);
      if (error) throw new Error(error.message);
      return;
    }
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
  },
};
