import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { logger } from "../../lib/logger";
import { settingsService } from "../../services/settings/settingsService";
import { TIMEFRAMES } from "../../types/settings";

const EmaSchema = z
  .array(
    z.object({
      period: z
        .number()
        .int()
        .min(1, "EMAの期間は1以上にしてください")
        .max(1000),
      visible: z.boolean(),
    }),
  )
  .max(8, "EMAは8本まで設定できます")
  .refine(
    (a) => new Set(a.map((e) => e.period)).size === a.length,
    "EMAの期間が重複しています",
  );

const PutSettingsSchema = z.object({
  balanceJpy: z
    .number()
    .int("口座残高は整数で入力してください")
    .positive("口座残高は1円以上で入力してください")
    .optional(),
  maxRiskPct: z
    .number()
    .gt(0, "最大リスクは0より大きくしてください")
    .max(100)
    .optional(),
  minRr: z
    .number()
    .gt(0, "最低リスクリワードは0より大きくしてください")
    .max(100)
    .optional(),
  timezone: z.string().min(1).max(64).optional(),
  chartDefaultTf: z.enum(TIMEFRAMES).optional(),
  chartBarsBefore: z.number().int().min(1).max(2000).optional(),
  chartBarsAfter: z.number().int().min(1).max(2000).optional(),
  emaSettings: EmaSchema.optional(),
});

/** GET /settings（未作成なら404） */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    logger.info("GET /settings", { userId });
    return success(await settingsService.get(userId));
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /settings */
export const putHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, PutSettingsSchema);
    logger.info("PUT /settings", { userId });
    return success(await settingsService.save(userId, body));
  } catch (e) {
    return errorResponse(e);
  }
};
