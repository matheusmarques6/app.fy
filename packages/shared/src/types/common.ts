/** Standard paginated request params */
export interface PaginationParams {
  readonly page: number
  readonly perPage: number
}

/** Standard paginated response wrapper */
export interface PaginatedResponse<T> {
  readonly data: T[]
  readonly meta: {
    readonly page: number
    readonly perPage: number
    readonly total: number
    readonly totalPages: number
  }
}

/** Standard API success response */
export interface ApiResponse<T> {
  readonly data: T
}

/** Standard API error response */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly details?: unknown
  }
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc'

/** Generic ID param */
export interface IdParam {
  readonly id: string
}

/** Timestamp fields present on most entities */
export interface Timestamps {
  readonly createdAt: Date
  readonly updatedAt: Date
}
