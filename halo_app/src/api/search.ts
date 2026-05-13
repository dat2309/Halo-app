import type { AxiosError } from 'axios';
import { createInfiniteQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';
import type { PostDto } from './posts/types';

export type SearchUserDto = {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
};

type SearchUsersVariables = { q: string; limit?: number };
type DiscoverVariables = { q?: string; limit?: number };

export const useSearchUsers = createInfiniteQuery<
  PaginatedResult<SearchUserDto>,
  SearchUsersVariables,
  AxiosError
>({
  queryKey: ['search-users'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<
      ApiResponse<PaginatedResult<SearchUserDto>>
    >('/users/search', {
      params: { q: variables.q, page: pageParam, limit: variables.limit ?? 20 },
    });
    return response.data.data;
  },
  getNextPageParam: (lastPage) => {
    if (lastPage.list.length < lastPage.limit) return undefined;
    return lastPage.page + 1;
  },
  initialPageParam: 1,
});

export const useDiscoverPosts = createInfiniteQuery<
  PaginatedResult<PostDto>,
  DiscoverVariables,
  AxiosError
>({
  queryKey: ['discover-posts'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<ApiResponse<PaginatedResult<PostDto>>>(
      '/posts/discover',
      {
        params: {
          q: variables.q,
          page: pageParam,
          limit: variables.limit ?? 12,
        },
      }
    );
    return response.data.data;
  },
  getNextPageParam: (lastPage) => {
    if (lastPage.list.length < lastPage.limit) return undefined;
    return lastPage.page + 1;
  },
  initialPageParam: 1,
});
