/**
 * バックエンド共通型定義
 *
 * DBから取得したエンティティや、APIのリクエスト/レスポンス型をここに定義する。
 * 機能固有の型は各 handlers/ や services/ に定義し、複数箇所で使う型のみここへ移動する。
 */

/** ユーザーエンティティ */
export interface User {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/** ページネーション用カーソル */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}
