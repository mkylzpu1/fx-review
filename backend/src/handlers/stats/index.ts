import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseQuery } from "../../lib/validate";
import { statsService } from "../../services/stats/statsService";

const IsoDate = (name: string) =>
  z
    .string()
    .datetime({ offset: true, message: `${name}はISO日時で指定してください` })
    .optional();

const QuerySchema = z.object({
  from: IsoDate("from"),
  to: IsoDate("to"),
  pair: z.string().max(20).optional(),
});

/** GET /stats */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, QuerySchema);
    return success(await statsService.get(userId, q));
  } catch (e) {
    return errorResponse(e);
  }
};
