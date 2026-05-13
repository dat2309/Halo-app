import type { AxiosError } from 'axios';
import { createInfiniteQuery, createMutation, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse } from './types';

export type ChatParticipant = {
  _id: string;
  name?: string;
  username?: string;
  avatar?: string;
};

export type ConversationDto = {
  _id: string;
  participants: ChatParticipant[];
  lastMessage?: string;
  lastMessageType?: 'text' | 'image' | 'video';
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
};

export type MessageDto = {
  _id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'video';
  content?: string;
  mediaUrl?: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type MessagesPage = {
  list: MessageDto[];
  nextCursor: string | null;
  limit: number;
};

export const useConversations = createQuery<
  ConversationDto[],
  void,
  AxiosError
>({
  queryKey: ['chat-conversations'],
  fetcher: async () => {
    const response = await client.get<ApiResponse<ConversationDto[]>>(
      '/chat/conversations'
    );
    return response.data.data;
  },
});

export const useGetOrCreateConversation = createMutation<
  ConversationDto,
  { peerId: string },
  AxiosError
>({
  mutationFn: async ({ peerId }) => {
    const response = await client.post<ApiResponse<ConversationDto>>(
      '/chat/conversations',
      { peerId }
    );
    return response.data.data;
  },
});

export const useMessages = createInfiniteQuery<
  MessagesPage,
  { conversationId: string; limit?: number },
  AxiosError
>({
  queryKey: ['chat-messages'],
  fetcher: async (variables, { pageParam }) => {
    const response = await client.get<ApiResponse<MessagesPage>>(
      `/chat/conversations/${variables.conversationId}/messages`,
      {
        params: {
          cursor: pageParam || undefined,
          limit: variables.limit ?? 30,
        },
      }
    );
    return response.data.data;
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  initialPageParam: null as string | null,
});

export const useMarkConversationRead = createMutation<
  { success: boolean },
  { conversationId: string },
  AxiosError
>({
  mutationFn: async ({ conversationId }) => {
    const response = await client.post<ApiResponse<{ success: boolean }>>(
      `/chat/conversations/${conversationId}/read`
    );
    return response.data.data;
  },
});

export type IceServersDto = {
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
};

export const useIceServers = createQuery<IceServersDto, void, AxiosError>({
  queryKey: ['call-ice-servers'],
  fetcher: async () => {
    const response = await client.get<ApiResponse<IceServersDto>>(
      '/call/ice-servers'
    );
    return response.data.data;
  },
});

export type CallHistoryItem = {
  _id: string;
  callerId: ChatParticipant | string;
  calleeId: ChatParticipant | string;
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'aborted';
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
};

export const useCallHistory = createQuery<
  CallHistoryItem[],
  { limit?: number },
  AxiosError
>({
  queryKey: ['call-history'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<CallHistoryItem[]>>(
      '/call/history',
      { params: { limit: variables?.limit ?? 30 } }
    );
    return response.data.data;
  },
});
