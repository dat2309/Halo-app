import { Env } from '@env';
import axios from 'axios';
import { showMessage } from 'react-native-flash-message';

import { signOut, useAuth } from '@/lib/auth';
import { translate } from '@/lib/i18n';

import { logError, logRequest, logResponse } from './logger';

/* -------------------------------------------------------------------------- */
/*                               AXIOS INSTANCE                               */
/* -------------------------------------------------------------------------- */

export const client = axios.create({
  baseURL: Env.API_URL,
});

/* -------------------------------------------------------------------------- */
/*                              REQUEST INTERCEPTOR                           */
/* -------------------------------------------------------------------------- */

client.interceptors.request.use(
  (config) => {
    const token = useAuth.getState().token;

    if (token?.access) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token.access}`,
      } as any;
    }

    // Stamp start time so the response interceptor can compute duration
    (config as any).metadata = { startTime: Date.now() };

    logRequest({
      method: config.method,
      baseURL: config.baseURL,
      url: config.url,
      params: config.params,
      data: config.data,
      headers: config.headers as Record<string, unknown>,
    });

    return config;
  },
  (error) => {
    logError(error?.config, undefined, 0, error?.message);
    return Promise.reject(error);
  }
);

/* -------------------------------------------------------------------------- */
/*                          REFRESH TOKEN STATE                               */
/* -------------------------------------------------------------------------- */

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

const elapsed = (config: any): number => {
  const start = config?.metadata?.startTime;
  return start ? Date.now() - start : 0;
};

/* -------------------------------------------------------------------------- */
/*                          RESPONSE INTERCEPTOR                              */
/* -------------------------------------------------------------------------- */

client.interceptors.response.use(
  (response) => {
    const durationMs = elapsed(response.config);
    logResponse(
      {
        method: response.config.method,
        baseURL: response.config.baseURL,
        url: response.config.url,
      },
      response.status,
      durationMs,
      response.data
    );

    // Check for 401 in response body (some endpoints return 200 with status:401 inside)
    if (response.data?.status === 401 || response.data?.status === '401') {
      return Promise.reject({
        config: response.config,
        response: {
          status: 401,
          data: response.data,
        },
        isAxiosError: true,
      });
    }
    return response;
  },

  async (error) => {
    const originalRequest = error.config as any;
    const durationMs = elapsed(originalRequest);
    logError(
      originalRequest
        ? {
            method: originalRequest.method,
            baseURL: originalRequest.baseURL,
            url: originalRequest.url,
          }
        : undefined,
      error.response?.status,
      durationMs,
      error.response?.data?.message ?? error.message,
      error.response?.data
    );

    // Don't retry if not 401 or already retried or is refresh endpoint
    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    /* -------------------------- REFRESH TOKEN FLOW -------------------------- */

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(client(originalRequest));
          },
          reject: (err: any) => {
            reject(err);
          },
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const currentToken = useAuth.getState().token;

    if (!currentToken?.refresh) {
      isRefreshing = false;
      signOut();
      showMessage({
        message: translate('session.expired_title'),
        description: translate('session.expired_desc'),
        type: 'danger',
        icon: 'danger',
      });
      processQueue(error, null);
      return Promise.reject(error);
    }

    try {
      const refreshResponse = await axios.post(`${Env.API_URL}/auth/refresh`, {
        refreshToken: currentToken.refresh,
      });

      const newAccessToken = refreshResponse.data?.data?.accessToken;

      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }

      const newToken = {
        ...currentToken,
        access: newAccessToken,
      };
      useAuth.getState().signIn(newToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      processQueue(null, newAccessToken);
      isRefreshing = false;

      return client(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;

      signOut();
      showMessage({
        message: translate('session.expired_title'),
        description: translate('session.expired_desc'),
        type: 'danger',
        icon: 'danger',
      });

      return Promise.reject(refreshError);
    }
  }
);
