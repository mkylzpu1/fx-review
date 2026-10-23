/**
 * アプリケーション共通エラークラス
 *
 * ハンドラーでは必ず errorResponse(e) を使ってこれらをHTTPレスポンスに変換する。
 * 新しいエラー種別が必要な場合はここに追加し、lib/response.ts の errorResponse も更新する。
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 400: リクエストのバリデーションエラー */
export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

/** 401: 認証エラー */
export class UnauthorizedError extends AppError {
  constructor(message = "認証が必要です") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

/** 403: 権限エラー */
export class ForbiddenError extends AppError {
  constructor(message = "この操作は許可されていません") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

/** 404: リソース未存在 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource}が見つかりません`, 404);
    this.name = "NotFoundError";
  }
}

/** 409: 状態の競合 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

/** 500: 予期しないサーバーエラー */
export class InternalError extends AppError {
  constructor(message = "内部エラーが発生しました") {
    super("INTERNAL_ERROR", message, 500);
    this.name = "InternalError";
  }
}
