import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse } from './types';

export type UploadResponseDto = {
  /** Public HTTPS URL of the uploaded asset (Cloudinary CDN) */
  url: string;
  /** Cloudinary public_id — use for delete/transform later */
  publicId?: string;
  /** image | video | raw */
  resourceType?: 'image' | 'video' | 'raw';
  /** File format (jpg, png, mp4, ...) */
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
  originalName?: string;
  mimetype?: string;
  /** @deprecated kept for backwards compat with old responses */
  originalname?: string;
  /** @deprecated alias for `bytes` */
  size?: number;
};

type Variables = {
  uri: string;
  name?: string;
  type?: string;
};

export const useUpload = createMutation<
  UploadResponseDto,
  Variables,
  AxiosError
>({
  mutationFn: async ({ uri, name = 'upload', type = 'application/octet-stream' }) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name,
      type,
    } as unknown as Blob);

    const response = await client.post<ApiResponse<UploadResponseDto>>(
      '/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },
});


