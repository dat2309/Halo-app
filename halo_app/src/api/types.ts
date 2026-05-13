export type PaginateQuery<T> = {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
};

export type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

export type PaginatedResult<T> = {
  list: T[];
  total: number;
  page: number;
  limit: number;
};
