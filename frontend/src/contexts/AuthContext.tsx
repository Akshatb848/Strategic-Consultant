import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authAPI, setAccessToken, clearAccessToken } from '../lib/apiClient';
import { connectSocket, disconnectSocket } from '../lib/socketClient';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  organisation: string;
  role: string;
  plan: string;
  avatarInitials: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  analysisCount: number;
  authProvider: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    title?: string;
    organisation?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setUserFromOAuth: (token: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      // Try token refresh (uses httpOnly cookie)
      const { data } = await authAPI.refresh();
      setAccessToken(data.accessToken);
      const meRes = await authAPI.me();
      setUser(meRes.data.user);
      connectSocket();
    } catch {
      // No valid session — that's fine
      clearAccessToken();
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const { data } = await authAPI.login(email, password);
      setAccessToken(data.accessToken);
      setUser(data.user);
      connectSocket();
      return { success: true };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      const code = err.response?.data?.code;
      setError(msg);
      return { success: false, error: msg, code };
    }
  }, []);

  const signup = useCallback(async (signupData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    title?: string;
    organisation?: string;
  }) => {
    try {
      setError(null);
      const { data } = await authAPI.signup(signupData);
      setAccessToken(data.accessToken);
      setUser(data.user);
      connectSocket();
      return { success: true };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Signup failed. Please try again.';
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Continue logout even if API fails
    }
    clearAccessToken();
    disconnectSocket();
    setUser(null);
  }, []);

  const setUserFromOAuth = useCallback(async (token: string) => {
    setAccessToken(token);
    try {
      const { data } = await authAPI.me();
      setUser(data.user);
      connectSocket();
    } catch {
      clearAccessToken();
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, signup, logout, setUserFromOAuth, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
