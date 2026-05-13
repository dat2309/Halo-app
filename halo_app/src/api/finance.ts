import type { AxiosError } from 'axios';
import { createMutation, createInfiniteQuery, createQuery } from 'react-query-kit';

import { client } from './common';
import type { ApiResponse, PaginatedResult } from './types';

export type FinanceTransactionDto = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note?: string;
  date: string;
  receiptImageUrl?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type ListVariables = {
  limit?: number;
  startDate?: string;
  endDate?: string;
};
type CreateVariables = Omit<
  FinanceTransactionDto,
  '_id' | 'userId' | 'createdAt' | 'updatedAt'
>;
type UpdateVariables = Partial<CreateVariables> & { id: string };

export const useFinance = createInfiniteQuery<
  PaginatedResult<FinanceTransactionDto>,
  ListVariables,
  AxiosError
>({
  queryKey: ['finance'],
  fetcher: async (variables, { pageParam = 1 }) => {
    const response = await client.get<
      ApiResponse<PaginatedResult<FinanceTransactionDto>>
    >('/finance', {
      params: {
        page: pageParam,
        limit: variables?.limit ?? 10,
        startDate: variables?.startDate,
        endDate: variables?.endDate,
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

type SummaryVariables = { year: number };
export type FinanceSummaryDto = {
  month: number;
  income: number;
  expense: number;
};

export const useFinanceSummary = createQuery<
  FinanceSummaryDto[],
  SummaryVariables,
  AxiosError
>({
  queryKey: ['finance-summary'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<FinanceSummaryDto[]>>(
      '/finance/summary',
      {
        params: { year: variables.year },
      }
    );
    return response.data?.data ?? [];
  },
});

export const useCreateFinance = createMutation<
  FinanceTransactionDto,
  CreateVariables,
  AxiosError
>({
  mutationFn: async (payload) => {
    const response = await client.post<
      ApiResponse<FinanceTransactionDto>
    >('/finance', payload);
    return response.data.data;
  },
});

export const useUpdateFinance = createMutation<
  FinanceTransactionDto,
  UpdateVariables,
  AxiosError
>({
  mutationFn: async ({ id, ...payload }) => {
    const response = await client.patch<
      ApiResponse<FinanceTransactionDto>
    >(`/finance/${id}`, payload);
    return response.data.data;
  },
});

export const useDeleteFinance = createMutation<
  { success: boolean },
  { id: string },
  AxiosError
>({
  mutationFn: async ({ id }) => {
    await client.delete(`/finance/${id}`);
    return { success: true };
  },
});

type CalendarVariables = { year: number; month: number };
type CalendarData = Record<string, FinanceTransactionDto[]>;

export const useFinanceCalendar = createQuery<
  CalendarData,
  CalendarVariables,
  AxiosError
>({
  queryKey: ['finance-calendar'],
  fetcher: async (variables) => {
    const response = await client.get<ApiResponse<CalendarData>>(
      '/finance/calendar',
      { params: { year: variables.year, month: variables.month } }
    );
    return response.data?.data ?? {};
  },
});


