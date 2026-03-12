import type { PaginatedResponse, PaginationParams } from '@appfy/shared'

/** Default pagination values */
export const DEFAULT_PAGE = 1
export const DEFAULT_PER_PAGE = 20
export const MAX_PER_PAGE = 100

/** Normalizes pagination params with defaults and bounds */
export function normalizePagination(params?: Partial<PaginationParams>): PaginationParams {
  const page = Math.max(1, params?.page ?? DEFAULT_PAGE)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, params?.perPage ?? DEFAULT_PER_PAGE))
  return { page, perPage }
}

/** Calculates SQL offset from pagination params */
export function paginationOffset(params: PaginationParams): number {
  return (params.page - 1) * params.perPage
}

/** Builds a PaginatedResponse wrapper from data + total count */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: params.page,
      perPage: params.perPage,
      total,
      totalPages: Math.ceil(total / params.perPage),
    },
  }
}
