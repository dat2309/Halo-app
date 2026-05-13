import type { AxiosError } from 'axios';
import { createMutation, createInfiniteQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';

export type CommentDto = {
  _id: string;
  content: string;
  postId: string;
  createdAt: string;
  updatedAt: string;
  userId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  parentId?: string;
};

type ListVariables = { postId: string; limit?: number };
type CreateVariables = { postId: string; content: string; parentId?: string };

export const useComments = createInfiniteQuery<
  PaginatedResult<CommentDto>,
  ListVariables,
  AxiosError
>({
  queryKey: ['comments'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<ApiResponse<PaginatedResult<CommentDto>>>(
      `/posts/${variables.postId}/comments`,
      {
        params: {
          page: pageParam,
          limit: variables?.limit ?? 20,
        },
      }
    );
    return response.data.data;
  },
  getNextPageParam: (lastPage) => {
    if (lastPage.list.length < lastPage.limit) {
      return undefined;
    }
    return lastPage.page + 1;
  },
  initialPageParam: 1,
});

export const useAddComment = createMutation<
  CommentDto,
  CreateVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.post<ApiResponse<CommentDto>>(
      `/posts/${variables.postId}/comments`,
      { content: variables.content, parentId: variables.parentId }
    );
    return response.data.data;
  },
});

export const useDeleteComment = createMutation<
  { success: boolean },
  { postId: string; id: string },
  AxiosError
>({
  mutationFn: async (variables) => {
    await client.delete(`/posts/${variables.postId}/comments/${variables.id}`);
    return { success: true };
  },
});


