import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { client } from '../common';
import type { ApiResponse } from '../types';
import type { PostDto } from './types';

type Variables = {
  type: 'image' | 'video';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  visibility?: 'public' | 'private';
};
type Response = PostDto;

export const useAddPost = () => {
  const queryClient = useQueryClient();

  return useMutation<Response, AxiosError, Variables>({
    mutationFn: async (variables) => {
      const response = await client.post<ApiResponse<PostDto>>(
        '/posts',
        variables
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
};