import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserProfile, UserRole, UserStatus } from '../types';
import { apiRequest } from './apiClient';

function mapProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as UserRole,
    status: row.status as UserStatus,
    department: String(row.department ?? 'Operations Control'),
    jobTitle: String(row.job_title ?? 'Operations Specialist'),
    area: String(row.area ?? 'Region West'),
    branch: String(row.branch ?? 'North Hub Branch'),
    outlet: String(row.outlet ?? 'Outlet 01 - Flagship Plaza'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const userService = {
  async list(): Promise<UserProfile[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapProfile(row as Record<string, unknown>));
    }
    return apiRequest<UserProfile[]>('/api/users');
  },

  async create(input: {
    email: string;
    fullName: string;
    role: UserRole;
    department: string;
    jobTitle: string;
    area?: string;
    branch?: string;
    outlet?: string;
    password?: string;
  }): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      throw new Error(
        'In hosted Supabase mode, users sign up via Email Auth or are invited from the Supabase Dashboard.'
      );
    }
    return apiRequest<UserProfile>('/api/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async update(
    id: string,
    updates: Partial<
      Pick<UserProfile, 'role' | 'status' | 'department' | 'jobTitle' | 'area' | 'branch' | 'outlet'>
    >
  ): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const payload: Record<string, unknown> = {};
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.department !== undefined) payload.department = updates.department;
      if (updates.jobTitle !== undefined) payload.job_title = updates.jobTitle;
      if (updates.area !== undefined) payload.area = updates.area;
      if (updates.branch !== undefined) payload.branch = updates.branch;
      if (updates.outlet !== undefined) payload.outlet = updates.outlet;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error || !data) throw new Error(error?.message || 'Failed to update user');
      return mapProfile(data as Record<string, unknown>);
    }

    return apiRequest<UserProfile>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};
