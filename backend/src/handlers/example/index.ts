/**
 * サンプルCRUDハンドラー
 *
 * 新しい機能を追加するときはこのファイルを参考に実装する。
 * 実際に使わない場合はこのファイルを削除してよい。
 *
 * 責務:
 *   - リクエストのパース・バリデーション
 *   - 認証・認可チェック
 *   - service / store の呼び出し
 *   - レスポンスの組み立て
 *
 * ビジネスロジックはここに書かず services/ に切り出す。
 * DBアクセスはここに書かず stores/ に切り出す。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { NotFoundError } from "../../lib/errors";
import { logger } from "../../lib/logger";

// ── スキーマ定義 ──────────────────────────────────────────

const CreateItemSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100),
  description: z.string().optional(),
});

// ── ハンドラー ────────────────────────────────────────────

/** GET /example/:id */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = await verifyAuth(event);
    const id = event.pathParameters?.id;
    if (!id) throw new NotFoundError("item");

    logger.info("GET /example/:id", { userId: authUser.userId, id });

    // TODO: store から取得する
    // const item = await exampleStore.get(id);
    // if (!item) throw new NotFoundError("item");

    return success({ id, title: "サンプル", userId: authUser.userId });
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /example */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = await verifyAuth(event);
    const body = parseBody(event.body, CreateItemSchema);

    logger.info("POST /example", {
      userId: authUser.userId,
      title: body.title,
    });

    // TODO: store に保存する
    // const item = await exampleStore.create({ ...body, userId: authUser.userId });

    return success({ id: "new-id", ...body, userId: authUser.userId }, 201);
  } catch (e) {
    return errorResponse(e);
  }
};
