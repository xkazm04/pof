import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';

// ---- Server-side helpers (used in route handlers) ----

/** Return a success envelope with the given data and optional status code. */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } satisfies ApiResponse<T>, { status });
}

/** Return an error envelope with the given message, status code, and optional details. */
export function apiError(message: string, status = 500, details?: unknown) {
  const body: { success: false; error: string; details?: unknown } = { success: false, error: message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body satisfies ApiResponse<never>, { status });
}

// ---- Client-side helper (used in hooks/components) ----

/** Fetch an API route and unwrap the standardized envelope. Throws on error responses. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
