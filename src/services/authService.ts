import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';
import { apiRequest, setAuthToken } from './apiClient';

function mapSupabaseProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as UserRole,
    status: row.status as UserProfile['status'],
    department: String(row.department ?? 'Operations Control'),
    jobTitle: String(row.job_title ?? 'Operations Specialist'),
    area: String(row.area ?? 'Region West'),
    branch: String(row.branch ?? 'North Hub Branch'),
    outlet: String(row.outlet ?? 'Outlet 01 - Flagship Plaza'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const authService = {
  async login(email: string, password: string): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message || 'Sign in failed');
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profError || !profile) throw new Error(profError?.message || 'Profile not found');
      const mapped = mapSupabaseProfile(profile);
      if (mapped.status !== 'Active') {
        await supabase.auth.signOut();
        throw new Error(`Account is ${mapped.status}. Contact an Admin.`);
      }
      return mapped;
    }

    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    return res.user;
  },

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    department: string;
    jobTitle: string;
    area?: string;
    branch?: string;
    outlet?: string;
  }): Promise<{ user: UserProfile | null; confirmationPending?: boolean }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            department: input.department,
            job_title: input.jobTitle,
            area: input.area ?? 'Region West',
            branch: input.branch ?? 'North Hub Branch',
            outlet: input.outlet ?? 'Outlet 01 - Flagship Plaza',
          },
        },
      });
      if (error || !data.user) throw new Error(error?.message || 'Registration failed');
      if (!data.session) {
        return { user: null, confirmationPending: true };
      }
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profError || !profile) throw new Error(profError?.message || 'Profile creation failed');
      return { user: mapSupabaseProfile(profile), confirmationPending: false };
    }

    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAuthToken(res.token);
    return { user: res.user, confirmationPending: false };
  },

  async demoLogin(role: UserRole): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      throw new Error('Sample role quick-login is only available in local preview mode.');
    }
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    setAuthToken(res.token);
    return res.user;
  },

  async getCurrentSessionUser(): Promise<UserProfile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
      return profile ? mapSupabaseProfile(profile) : null;
    }
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      return res.user;
    } catch {
      return null;
    }
  },

  async updateProfile(input: {
    fullName?: string;
    department?: string;
    jobTitle?: string;
    area?: string;
    branch?: string;
    outlet?: string;
    newPassword?: string;
  }): Promise<UserProfile> {
    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData.user) throw new Error('Not authenticated');

      if (input.newPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: input.newPassword });
        if (pwErr) throw new Error(pwErr.message);
      }

      const updates: Record<string, unknown> = {};
      if (input.fullName) updates.full_name = input.fullName;
      if (input.department) updates.department = input.department;
      if (input.jobTitle) updates.job_title = input.jobTitle;
      if (input.area) updates.area = input.area;
      if (input.branch) updates.branch = input.branch;
      if (input.outlet) updates.outlet = input.outlet;

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', sessionData.user.id)
        .select('*')
        .single();
      if (error || !profile) throw new Error(error?.message || 'Failed to update profile');
      return mapSupabaseProfile(profile);
    }

    const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return res.user;
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setAuthToken(null);
  },
};
