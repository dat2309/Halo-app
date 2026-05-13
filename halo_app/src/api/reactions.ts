import type { AxiosError } from 'axios';
import { createMutation, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';

export type ReactionDto = {
  _id: string;
  type: string;
  userId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
};

export type ToggleReactionResponse = {
  action: 'added' | 'removed';
  reaction: ReactionDto | null;
};

type ListVariables = { postId: string; page?: number; limit?: number };

export const useReactions = createQuery<
  PaginatedResult<ReactionDto>,
  ListVariables,
  AxiosError
>({
  queryKey: ['reactions'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<PaginatedResult<ReactionDto>>>(
      `/posts/${variables.postId}/reactions`,
      {
      params: {
        page: variables.page ?? 1,
        limit: variables.limit ?? 10,
      },
      }
    );
    return response.data.data;
  },
});

export const useToggleReaction = createMutation<
  ToggleReactionResponse,
  { postId: string; type?: string },
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.post<ApiResponse<ToggleReactionResponse>>(
      `/posts/${variables.postId}/reactions`,
      { type: variables.type ?? 'like' }
    );
    return response.data.data;
  },
});


