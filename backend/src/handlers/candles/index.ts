import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { TIMEFRAMES } from "../../constants/candles";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { AppError } from "../../lib/errors";
import { parseBody, parseQuery } from "../../lib/validate";
import { candleService } from "../../services/candles/candleService";

const IsoDate = (name: string) =>
  z
    .string({ required_error: `${name}を指定してください` })
    .datetime({ offset: true, message: `${name}はISO日時で指定してください` });

const QuerySchema = z.object({
  tf: z.enum(TIMEFRAMES, {
    errorMap: () => ({
      message: `tfは${TIMEFRAMES.join(" / ")}のいずれかです`,
    }),
  }),
  from: IsoDate("from"),
  to: IsoDate("to"),
  warmup: z
    .string()
    .regex(/^\d+$/, "warmupは整数で指定してください")
    .optional(),
});

/** 1回のバッチで受け付ける範囲の数（一覧の1ページぶんを超えない程度） */
export const MAX_BATCH_REQUESTS = 30;

const BatchBodySchema = z.object({
  requests: z
    .array(
      z.object({
        tf: QuerySchema.shape.tf,
        from: QuerySchema.shape.from,
        to: QuerySchema.shape.to,
        warmup: z.number().int().min(0).optional(),
      }),
    )
    .min(1, "requestsを1件以上指定してください")
    .max(MAX_BATCH_REQUESTS, `requestsは${MAX_BATCH_REQUESTS}件までです`),
});

/** GET /candles */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, QuerySchema);
    return success(
      await candleService.get({
        tf: q.tf,
        fromSec: Date.parse(q.from) / 1000,
        toSec: Date.parse(q.to) / 1000,
        warmup: q.warmup === undefined ? 0 : Number(q.warmup),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/**
 * POST /candles/batch
 * 一覧の各行のチャートなど、複数の範囲をまとめて取得する（行ごとに別のリクエストを送らないため）。
 * 範囲ごとに成功・失敗を返す。1つの範囲が広すぎても、ほかの範囲は返す。
 */
export const batchHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    await verifyAuth(event);
    const body = parseBody(event.body, BatchBodySchema);
    const results = await Promise.all(
      body.requests.map(async (r) => {
        try {
          return {
            ok: true as const,
            data: await candleService.get({
              tf: r.tf,
              fromSec: Date.parse(r.from) / 1000,
              toSec: Date.parse(r.to) / 1000,
              warmup: r.warmup ?? 0,
            }),
          };
        } catch (e) {
          // 想定内のエラー（範囲が広すぎるなど）はその範囲だけの失敗にする。想定外は全体を失敗させる
          if (e instanceof AppError)
            return { ok: false as const, code: e.code, message: e.message };
          throw e;
        }
      }),
    );
    return success({ results });
  } catch (e) {
    return errorResponse(e);
  }
};
