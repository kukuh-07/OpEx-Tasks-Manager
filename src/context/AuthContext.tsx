import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import type { UserProfile, UserRole } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    department: string;
    jobTitle: string;
  }) => Promise<{ confirmationPending: boolean }>;
  demoLogin: (role: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getCurrentSessionUser();
    setUser(profile);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await authService.getCurrentSessionUser();
        if (mounted) setUser(profile);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          if (mounted) setUser(null);
          return;
        }
        const profile = await authService.getCurrentSessionUser();
        if (mounted) setUser(profile);
      });
      return () => {
        mounted = false;
        data.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const profile = await authService.login(email, password);
    setUser(profile);
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      department: string;
      jobTitle: string;
    }) => {
      const result = await authService.register(input);
      if (result.user) setUser(result.user);
      return { confirmationPending: Boolean(result.confirmationPending) };
    },
    []
  );

  const demoLogin = useCallback(async (role: UserRole) => {
    const profile = await authService.demoLogin(role);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, demoLogin, refreshProfile, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
