import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { TIMEFRAMES } from "../../constants/candles";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseQuery } from "../../lib/validate";
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
