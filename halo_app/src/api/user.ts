import type { AxiosError } from 'axios';
import { createInfiniteQuery, createMutation, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';
import type { PostDto } from './posts/types';

export type UserProfileDto = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicProfileDto = {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
};

type UpdateProfileVariables = {
  name?: string;
  avatar?: string;
  bio?: string;
};

export const useProfile = createQuery<UserProfileDto, void, AxiosError>({
  queryKey: ['user-profile'],
  fetcher: async () => {
    const response = await client.get<ApiResponse<UserProfileDto>>(
      '/user/profile'
    );
    return response.data.data;
  },
});

export const useUpdateProfile = createMutation<
  UserProfileDto,
  UpdateProfileVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.patch<ApiResponse<UserProfileDto>>(
      '/user/profile',
      variables
    );
    return response.data.data;
  },
});

export const usePublicProfile = createQuery<
  PublicProfileDto,
  { id: string },
  AxiosError
>({
  queryKey: ['public-profile'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<PublicProfileDto>>(
      `/users/${variables.id}/profile`
    );
    return response.data.data;
  },
});

export const useUserPosts = createInfiniteQuery<
  PaginatedResult<PostDto>,
  { userId: string; limit?: number },
  AxiosError
>({
  queryKey: ['user-posts'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<ApiResponse<PaginatedResult<PostDto>>>(
      `/posts/user/${variables.userId}`,
      { params: { page: pageParam, limit: variables.limit ?? 12 } }
    );
    return response.data.data;
  },
  getNextPageParam: (lastPage) => {
    if (lastPage.list.length < lastPage.limit) return undefined;
    return lastPage.page + 1;
  },
  initialPageParam: 1,
});
