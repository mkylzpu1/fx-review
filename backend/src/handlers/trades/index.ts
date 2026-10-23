import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody, parseQuery } from "../../lib/validate";
import { ValidationError } from "../../lib/errors";
import { tradeService } from "../../services/trade/tradeService";
import {
  ListQuerySchema,
  QueueQuerySchema,
  TradeBodySchema,
  parseIntParam,
  toTradeInput,
} from "./schemas";

function getId(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.id;
  if (!id) throw new ValidationError("idが指定されていません");
  return id;
}

/** GET /trades */
export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, ListQuerySchema);
    return success(
      await tradeService.list(userId, {
        result: q.result,
        deviationOnly: q.deviationOnly === "true",
        q: q.q || undefined,
        pair: q.pair,
        from: q.from,
        to: q.to,
        pending: q.pending === "true",
        sort: q.sort ?? "entry_desc",
        page: parseIntParam(q.page, 1),
        limit: parseIntParam(q.limit, 20),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** GET /trades/queue */
export const queueHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, QueueQuerySchema);
    return success(
      await tradeService.queue(userId, {
        filter: q.filter ?? "all",
        sort: q.sort ?? "entry_desc",
        page: parseIntParam(q.page, 1),
        limit: parseIntParam(q.limit, 20),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /trades */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, TradeBodySchema);
    return success(await tradeService.create(userId, toTradeInput(body)), 201);
  } catch (e) {
    return errorResponse(e);
  }
};

/** GET /trades/{id} */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(await tradeService.get(userId, getId(event)));
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /trades/{id} */
export const updateHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, TradeBodySchema);
    return success(
      await tradeService.update(userId, getId(event), toTradeInput(body)),
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /trades/{id}（論理削除） */
export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    await tradeService.delete(userId, getId(event));
    return success({ id: getId(event) });
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /trades/{id}/restore */
export const restoreHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(await tradeService.restore(userId, getId(event)));
  } catch (e) {
    return errorResponse(e);
  }
};
