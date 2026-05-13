import type { AxiosError } from 'axios';
import { createQuery } from 'react-query-kit';

import { client } from '../common';
import type { ApiResponse } from '../types';
import type { PostDto } from './types';

type Variables = { id: string };
type Response = PostDto;

export const usePost = createQuery<Response, Variables, AxiosError>({
  queryKey: ['post'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<PostDto>>(
      `/posts/${variables.id}`
    );
    return response.data.data;
  },
});
