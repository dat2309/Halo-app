import type { AxiosError } from 'axios';
import { createMutation, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse } from './types';

type UserProfile = {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  username: string;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

type LoginVariables = {
  identifier: string; // email or phone
  password: string;
};

type RegisterVariables = {
  name: string;
  email: string;
  phone: string;
  username: string;
  password: string;
};

export const useLogin = createMutation<
  ApiResponse<AuthResponse>,
  LoginVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      variables
    );
    return response.data;
  },
});

export const useRegister = createMutation<
  ApiResponse<AuthResponse>,
  RegisterVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      variables
    );
    return response.data;
  },
});

export const useMe = createQuery<
  ApiResponse<UserProfile>,
  void,
  AxiosError
>({
  queryKey: ['me'],
  fetcher: async () => {
    const response = await client.get<ApiResponse<UserProfile>>(
      '/auth/me'
    );
    return response.data;
  },
});


