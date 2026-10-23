import { APIGatewayProxyResult } from "aws-lambda";
import { AppError } from "./errors";
import { logger } from "./logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
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
