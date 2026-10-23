/**
 * APIレスポンスの共通型定義
 *
 * バックエンドの lib/response.ts と対応させる。
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** ページネーション付きレスポンス */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  totalCount?: number;
}
