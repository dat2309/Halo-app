import axios from 'axios';

export const API_URL =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3003/api';

export const api = axios.create({ baseURL: API_URL });

const TOKEN_KEY = 'halo-web-token';

export type TokenPair = {
  access: string;
  refresh?: string;
};

export function getStoredToken(): TokenPair | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenPair) : null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: TokenPair | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token?.access) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token.access}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => {
    // Some endpoints return 200 with status:401 inside body — normalize to reject
    if (r.data?.status === 401 || r.data?.status === '401') {
      return Promise.reject({
        response: { status: 401, data: r.data },
        isAxiosError: true,
      });
    }
    return r;
  },
  (err) => Promise.reject(err)
);
