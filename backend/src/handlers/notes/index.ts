import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { ValidationError } from "../../lib/errors";
import { errorResponse, success } from "../../lib/response";
import { parseBody, parseQuery } from "../../lib/validate";
import { noteService } from "../../services/note/noteService";
import { parseIntParam } from "../trades/schemas";
import {
  AiNoteSchema,
  ListQuerySchema,
  NotePatchSchema,
  SelfNoteSchema,
} from "./schemas";

function param(event: APIGatewayProxyEvent, name: string): string {
  const v = event.pathParameters?.[name];
  if (!v) throw new ValidationError(`${name}が指定されていません`);
  return v;
}

/** GET /notes */
export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const q = parseQuery(event.queryStringParameters, ListQuerySchema);
    return success(
      await noteService.list(userId, {
        kind: q.kind,
        validatingOnly: q.validating === "true",
        page: parseIntParam(q.page, 1),
        limit: Math.min(parseIntParam(q.limit, 20), 50),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** GET /notes/{id} */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(await noteService.get(userId, param(event, "id")));
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /notes（自分の気づき） */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const b = parseBody(event.body, SelfNoteSchema);
    return success(
      await noteService.createSelf(userId, {
        title: b.title,
        body: b.body ?? "",
        emotionTags: b.emotionTags ?? [],
        nextRule: b.nextRule || null,
        sourceTradeId: b.sourceTradeId ?? null,
      }),
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /notes/ai */
export const createAiHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const b = parseBody(event.body, AiNoteSchema);
    return success(
      await noteService.createAi(userId, {
        aiName: b.aiName,
        dataRangeLabel: b.dataRangeLabel || null,
        rawResponse: b.rawResponse,
        title: b.title ?? null,
      }),
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /notes/{id} */
export const updateHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const b = parseBody(event.body, NotePatchSchema);
    return success(await noteService.update(userId, param(event, "id"), b));
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /notes/{id} */
export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    await noteService.delete(userId, param(event, "id"));
    return success({ id: param(event, "id") });
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /notes/{id}/improvements/{improvementId}/to-rule */
export const toRuleHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(
      await noteService.toRule(
        userId,
        param(event, "id"),
        param(event, "improvementId"),
      ),
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
};

/** GET /notes/validations（検証中の改善ルール） */
export const validationsHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success({ items: await noteService.validations(userId) });
  } catch (e) {
    return errorResponse(e);
  }
};
