import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Token storage — memory ONLY (never localStorage — XSS protection)
let _accessToken: string | null = null;
export const getAccessToken = () => _accessToken;
export const setAccessToken = (t: string | null) => { _accessToken = t; };
export const clearAccessToken = () => { _accessToken = null; };

// Axios instance
export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token to EVERY request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — silent token refresh on 401
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (error.response.data?.code === 'TOKEN_EXPIRED') {
        original._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const { data } = await axios.post(
              `${BASE_URL}/api/auth/refresh`,
              {},
              { withCredentials: true }
            );
            setAccessToken(data.accessToken);
            refreshSubscribers.forEach((cb) => cb(data.accessToken));
            refreshSubscribers = [];
            isRefreshing = false;
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(original);
          } catch {
            isRefreshing = false;
            clearAccessToken();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        } else {
          return new Promise((resolve) => {
            refreshSubscribers.push((token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            });
          });
        }
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed API functions ──────────────────────────────────────────────────────

export interface SignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  title?: string;
  organisation?: string;
}

export const authAPI = {
  signup: (data: SignupPayload) => api.post('/api/auth/signup', data),
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
  refresh: () => api.post('/api/auth/refresh'),
  me: () => api.get('/api/auth/me'),
};

export const analysesAPI = {
  create: (problemStatement: string) => api.post('/api/analyses', { problemStatement }),
  list: (params?: { status?: string; search?: string; limit?: number; offset?: number }) =>
    api.get('/api/analyses', { params }),
  get: (id: string) => api.get(`/api/analyses/${id}`),
  delete: (id: string) => api.delete(`/api/analyses/${id}`),
};

export const reportsAPI = {
  list: (params?: { search?: string; limit?: number; offset?: number }) =>
    api.get('/api/reports', { params }),
  get: (id: string) => api.get(`/api/reports/${id}`),
};
