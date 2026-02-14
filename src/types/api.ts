/** Standardized API response envelope used by all JSON routes. */
export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };
