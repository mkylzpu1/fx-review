import { APIGatewayProxyResult } from "aws-lambda";
import { AppError } from "./errors";
import { logger } from "./logger";

/**
 * 許可するオリジン。
 * - CORS_ALLOW_ORIGIN があればそれ（本番はフロントのURLを指定する）
 * - ローカル（IS_LOCAL=true）は認証が無いので、手元の画面（localhost:5173）だけに限る。
 *   "*" のままだと、閲覧中の別サイトから手元のAPIを呼ばれ、トレード記録を読み出し・削除されうる
 * - それ以外は従来どおり "*"（認証は Authorization ヘッダーで行い、Cookieは使わない）
 */
const ALLOW_ORIGIN =
  process.env.CORS_ALLOW_ORIGIN ??
  (process.env.IS_LOCAL === "true" ? "http://localhost:5173" : "*");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

/** 成功レスポンス */
export function success<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true, data }),
  };
}

/** エラーレスポンス（ハンドラーの catch で使う） */
export function errorResponse(e: unknown): APIGatewayProxyResult {
  if (e instanceof AppError) {
    return {
      statusCode: e.statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: { code: e.code, message: e.message },
      }),
    };
  }

  // 予期しないエラーはログに記録して500を返す
  logger.error("Unexpected error", { error: e });
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "内部エラーが発生しました" },
    }),
  };
}
