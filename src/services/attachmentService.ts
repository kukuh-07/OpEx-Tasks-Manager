import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { TaskAttachment } from '../types';
import { apiRequest, getAuthToken } from './apiClient';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.xlsx', '.xls', '.csv'];

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.xlsx'))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export const attachmentService = {
  async listByTask(taskId: string): Promise<TaskAttachment[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('task_attachments')
        .select(`*, uploader:profiles!task_attachments_uploaded_by_fkey(full_name)`)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        uploadedBy: String(row.uploaded_by),
        uploadedByName: (row.uploader as { full_name?: string } | null)?.full_name ?? 'Unknown',
        fileName: String(row.file_name),
        filePath: String(row.file_path),
        mimeType: String(row.mime_type),
        fileSize: Number(row.file_size),
        createdAt: String(row.created_at),
      }));
    }
    return apiRequest<TaskAttachment[]>(`/api/tasks/${taskId}/attachments`);
  },

  async upload(taskId: string, file: File): Promise<TaskAttachment> {
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      throw new Error('Unsupported file type. Upload PDF, Image, or Excel (.xlsx, .xls, .csv).');
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File exceeds the 15 MB limit.');
    }
    const mimeType = inferMimeType(file);

    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');
      const filePath = `${taskId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, { contentType: mimeType });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error: metaError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          uploaded_by: userData.user.id,
          file_name: file.name,
          file_path: filePath,
          mime_type: mimeType,
          file_size: file.size,
        })
        .select(`*, uploader:profiles!task_attachments_uploaded_by_fkey(full_name)`)
        .single();
      if (metaError || !data) throw new Error(metaError?.message || 'Failed to save attachment');
      return {
        id: String(data.id),
        taskId: String(data.task_id),
        uploadedBy: String(data.uploaded_by),
        uploadedByName: (data.uploader as { full_name?: string } | null)?.full_name ?? 'Unknown',
        fileName: String(data.file_name),
        filePath: String(data.file_path),
        mimeType: String(data.mime_type),
        fileSize: Number(data.file_size),
        createdAt: String(data.created_at),
      };
    }

    const dataBase64 = await fileToBase64(file);
    return apiRequest<TaskAttachment>(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType,
        dataBase64,
      }),
    });
  },

  async download(attachment: TaskAttachment): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.filePath);
      if (error || !data) throw new Error(error?.message || 'Download failed');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const token = getAuthToken();
    const res = await fetch(`/api/attachments/${attachment.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download file.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async remove(attachment: TaskAttachment): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.storage.from('task-attachments').remove([attachment.filePath]);
      const { error } = await supabase.from('task_attachments').delete().eq('id', attachment.id);
      if (error) throw new Error(error.message);
      return;
    }
    await apiRequest<{ deleted: boolean }>(`/api/attachments/${attachment.id}`, {
      method: 'DELETE',
    });
  },
};
