/**
 * The single fetch wrapper. No component or hook may call `fetch` directly.
 *
 * Owns three things:
 *  - the base URL (`VITE_API_BASE`),
 *  - JSON request/response handling,
 *  - error normalization to `ApiError { status, detail }` from FastAPI's
 *    `HTTPException` shape (`{"detail": ... }`).
 */

import { env } from "@/shared/config/env";

export type ApiErrorDetail = string | Record<string, unknown> | Array<unknown>;

/** Normalized transport/HTTP error. `status` is 0 for network/parse failures. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: ApiErrorDetail;

  constructor(status: number, detail: ApiErrorDetail) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  /** True for FastAPI's 422 request-validation shape. */
  get isValidationError(): boolean {
    return this.status === 422;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Serialized as JSON; sets `content-type` automatically. */
  body?: unknown;
  /** Entries with `null`/`undefined` values are dropped. */
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function apiUrl(path: string, query?: RequestOptions["query"]): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${env.apiBase}${suffix}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === null || item === undefined) continue;
      url.searchParams.append(key, String(item));
    }
  }
  return url.toString();
}

/** FastAPI puts the message under `detail`; fall back to the raw payload. */
function extractDetail(payload: unknown, status: number): ApiErrorDetail {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string" || Array.isArray(detail)) return detail;
    if (detail && typeof detail === "object") return detail as Record<string, unknown>;
  }
  if (typeof payload === "string" && payload.trim() !== "") return payload;
  return `HTTP ${status}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, headers } = options;

  const init: RequestInit = {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  };

  let response: Response;
  try {
    response = await fetch(apiUrl(path, query), init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, cause instanceof Error ? cause.message : "Network request failed");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text !== "") {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new ApiError(0, "Response was not valid JSON");
      throw new ApiError(response.status, text);
    }
  }

  if (!response.ok) throw new ApiError(response.status, extractDetail(payload, response.status));

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", ...(body === undefined ? {} : { body }) }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
} as const;
