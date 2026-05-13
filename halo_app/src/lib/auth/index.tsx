import { create } from 'zustand';

import { createSelectors } from '../utils';
import type { TokenType } from './utils';
import { getToken, removeToken, setToken } from './utils';
import { disconnectSocket } from '../socket';

interface AuthState {
  token: TokenType | null;
  status: 'idle' | 'signOut' | 'signIn';
  signIn: (data: TokenType) => void;
  signOut: () => void;
  hydrate: () => void;
}

const _useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  token: null,
  signIn: (token) => {
    setToken(token).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to persist auth token', error);
    });
    disconnectSocket();
    set({ status: 'signIn', token });
  },
  signOut: () => {
    removeToken().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to remove auth token', error);
    });
    disconnectSocket();
    set({ status: 'signOut', token: null });
  },
  hydrate: () => {
    // Async bootstrap from SecureStore
    void (async () => {
      try {
        const userToken = await getToken();
        if (userToken) {
          set({ status: 'signIn', token: userToken });
        } else {
          set({ status: 'signOut', token: null });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to hydrate auth token', error);
        set({ status: 'signOut', token: null });
      }
    })();
  },
}));

export const useAuth = createSelectors(_useAuth);

export const signOut = () => _useAuth.getState().signOut();
export const signIn = (token: TokenType) => _useAuth.getState().signIn(token);
export const hydrateAuth = () => _useAuth.getState().hydrate();
