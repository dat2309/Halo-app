import { createInfiniteQuery, createMutation, createQuery } from 'react-query-kit';
import { client } from './common';
import { ApiResponse, PaginatedResult } from './types';

export interface FriendUser {
    _id: string;
    username: string;
    name: string;
    avatar?: string;
}

export interface FriendRequest {
    _id: string;
    requester: FriendUser;
    recipient: string;
    status: 'pending' | 'active';
    createdAt: string;
}

// 1. Get Active Friends
export const useFriends = createQuery<FriendUser[]>({
    queryKey: ['friends'],
    fetcher: () => client.get('/friends').then((res) => res.data.data),
});

// 2. Get Pending Requests
export const usePendingRequests = createQuery<FriendRequest[]>({
    queryKey: ['friends', 'pending'],
    fetcher: () => client.get('/friends/pending').then((res) => res.data.data),
});

// 3. Lookup User by Username
export const useLookupUser = createMutation<{ username: string }, FriendUser>({
    mutationFn: (variables) =>
        client.get('/users/lookup', { params: variables }).then((res) => res.data.data),
});

// 4. Send Friend Request
export const useSendRequest = createMutation<{ username: string }>({
    mutationFn: (variables) => client.post('/friends/request', null, { params: variables }),
});

// 5. Accept Friend Request
export const useAcceptRequest = createMutation<{ requestId: string }>({
    mutationFn: (variables) => client.post(`/friends/${variables.requestId}/accept`),
});

// 6. Decline Friend Request
export const useDeclineRequest = createMutation<{ requestId: string }>({
    mutationFn: (variables) => client.post(`/friends/${variables.requestId}/decline`),
});

// 7. Unfriend
export const useUnfriend = createMutation<{ friendId: string }>({
    mutationFn: (variables) => client.delete(`/friends/${variables.friendId}`),
});
