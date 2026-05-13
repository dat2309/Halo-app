import type { AxiosError } from 'axios';
import { createMutation, createInfiniteQuery, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';

export type CalendarEventDto = {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  color?: string;
  reminder?: boolean;
  reminderTime?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type ListVariables = { date: string; limit?: number };
type CreateVariables = Omit<CalendarEventDto, '_id' | 'userId' | 'createdAt' | 'updatedAt'>;
type UpdateVariables = Partial<CreateVariables> & { id: string };

export type CalendarSummaryDto = Pick<CalendarEventDto, '_id' | 'startDate' | 'endDate' | 'color' | 'title'>;

type SummaryVariables = { month: number; year: number };

export const useUpcomingEvents = createQuery<
  CalendarEventDto[],
  { limit?: number },
  AxiosError
>({
  queryKey: ['calendar-upcoming'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<CalendarEventDto[]>>(
      '/calendar/upcoming',
      { params: { limit: variables?.limit ?? 5 } }
    );
    return response.data.data;
  },
});

export const useCalendarSummary = createQuery<
  CalendarSummaryDto[],
  SummaryVariables,
  AxiosError
>({
  queryKey: ['calendar-summary'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<CalendarSummaryDto[]>>(
      '/calendar/summary',
      {
        params: {
          month: variables.month,
          year: variables.year,
        },
      }
    );
    return response.data.data;
  },
});

export const useCalendarEvents = createInfiniteQuery<
  PaginatedResult<CalendarEventDto>,
  ListVariables,
  AxiosError
>({
  queryKey: ['calendar-events'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<
      ApiResponse<PaginatedResult<CalendarEventDto>>
    >('/calendar', {
      params: {
        date: variables.date,
        page: pageParam,
        limit: variables?.limit ?? 10,
      },
    });
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

export const useCreateEvent = createMutation<
  CalendarEventDto,
  CreateVariables,
  AxiosError
>({
  mutationFn: async (variables) => {
    const response = await client.post<ApiResponse<CalendarEventDto>>(
      '/calendar',
      variables
    );
    return response.data.data;
  },
});

export const useUpdateEvent = createMutation<
  CalendarEventDto,
  UpdateVariables,
  AxiosError
>({
  mutationFn: async ({ id, ...payload }) => {
    const response = await client.patch<ApiResponse<CalendarEventDto>>(
      `/calendar/${id}`,
      payload
    );
    return response.data.data;
  },
});

export const useDeleteEvent = createMutation<
  { success: boolean },
  { id: string },
  AxiosError
>({
  mutationFn: async ({ id }) => {
    await client.delete(`/calendar/${id}`);
    return { success: true };
  },
});


