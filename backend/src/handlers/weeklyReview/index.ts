import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody, parseQuery } from "../../lib/validate";
import { weeklyService } from "../../services/weekly/weeklyService";

const WeekStart = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStartはYYYY-MM-DDで指定してください");

const GetQuery = z.object({ weekStart: WeekStart.optional() });
const PutQuery = z.object({ weekStart: WeekStart });
const PutBody = z.object({
  memo: z.string().max(2000, "ふりかえりは2000文字までです").optional(),
  nextRuleId: z.string().uuid().nullable().optional(),
  nextRuleText: z
    .string()
    .trim()
    .max(200, "ルールは200文字までです")
    .nullable()
    .optional(),
});

/** GET /weekly-review?weekStart= */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, GetQuery);
    return success(await weeklyService.get(userId, q.weekStart));
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /weekly-review?weekStart= */
export const putHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, PutQuery);
    const body = parseBody(event.body, PutBody);
    return success(
      await weeklyService.save(userId, q.weekStart, {
        memo: body.memo ?? "",
        nextRuleId: body.nextRuleId ?? null,
        nextRuleText: body.nextRuleText || null,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};
