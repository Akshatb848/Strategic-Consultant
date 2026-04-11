"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authAPI, bootstrapSession, clearAccessToken, setAccessToken, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; first_name: string; last_name: string; organisation_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const sessionUser = await bootstrapSession();
        if (mounted) setUser(sessionUser);
      } catch {
        clearAccessToken();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      async login(email, password) {
        const response = await authAPI.login(email, password);
        setAccessToken(response.data.access_token);
        setUser(response.data.user);
      },
      async register(payload) {
        const response = await authAPI.register(payload);
        setAccessToken(response.data.access_token);
        setUser(response.data.user);
      },
      async logout() {
        try {
          await authAPI.logout();
        } finally {
          clearAccessToken();
          setUser(null);
        }
      },
      async refreshUser() {
        const response = await authAPI.me();
        setUser(response.data.user);
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
