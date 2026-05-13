import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  api,
  getStoredToken,
  setStoredToken,
  type TokenPair,
} from './api';
import { disconnectSocket } from './socket';

export type Me = {
  _id: string;
  name?: string;
  username?: string;
  email?: string;
  avatar?: string;
};

type AuthContextValue = {
  token: TokenPair | null;
  me: Me | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<TokenPair | null>(() => getStoredToken());
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch /auth/me whenever a token becomes available
  useEffect(() => {
    let active = true;
    if (!token?.access) {
      setMe(null);
      return;
    }
    setLoading(true);
    api
      .get('/auth/me')
      .then((res) => {
        if (!active) return;
        setMe(res.data?.data ?? null);
      })
      .catch(() => {
        if (!active) return;
        // Token invalid → log out
        setStoredToken(null);
        setToken(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token?.access]);

  const login = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { identifier, password });
      const data = res.data?.data;
      if (!data?.accessToken) {
        throw new Error(res.data?.message ?? 'Login failed');
      }
      const newToken: TokenPair = {
        access: data.accessToken,
        refresh: data.refreshToken,
      };
      setStoredToken(newToken);
      setToken(newToken);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    setStoredToken(null);
    setToken(null);
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, me, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
