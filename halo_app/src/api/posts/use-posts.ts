import type { AxiosError } from 'axios';
import { createInfiniteQuery } from 'react-query-kit';

import { client } from '../common';
import type { ApiResponse, PaginatedResult } from '../types';
import type { PostDto } from './types';

type Response = PaginatedResult<PostDto>;
type Variables = { limit?: number };

export const usePosts = createInfiniteQuery<Response, Variables, AxiosError>({
  queryKey: ['posts'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<ApiResponse<Response>>(
      '/posts',
      {
        params: {
          page: pageParam,
          limit: variables?.limit ?? 1,
        },
      }
    );
    return response.data.data;
  },
  getNextPageParam: (lastPage, allPages) => {
    // If returned data length is less than limit, we've reached the end
    // If it equals limit, there might be more pages
    if (lastPage.list.length < lastPage.limit) {
      return undefined; // No more pages
    }
    return lastPage.page + 1; // Load next page
  },
  initialPageParam: 1,
});
