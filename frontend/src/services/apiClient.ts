import { fetchAuthSession } from "aws-amplify/auth";
import type { ApiResponse } from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/** 認証トークンを取得 */
async function getAuthToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  } catch {
    return undefined;
  }
}

let onUnauthorized: (() => void) | null = null;

/** 401（ログイン切れ）を受けたときに呼ぶ処理を登録する。解除は null */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** APIリクエストの共通処理 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError("UNAUTHORIZED", "ログインの有効期限が切れました", 401);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }

  return json.data;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
