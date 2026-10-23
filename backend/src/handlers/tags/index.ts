import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody, parseQuery } from "../../lib/validate";
import { ValidationError } from "../../lib/errors";
import { tagService } from "../../services/settings/tagService";

const KindSchema = z.enum(["rationale", "emotion"]);
const NameSchema = z
  .string()
  .trim()
  .min(1, "タグ名を入力してください")
  .max(30, "タグ名は30文字までです");

const CreateSchema = z.object({ kind: KindSchema, name: NameSchema });
const UpdateSchema = z.object({
  name: NameSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const ListQuerySchema = z.object({ kind: KindSchema.optional() });

function getId(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.id;
  if (!id) throw new ValidationError("idが指定されていません");
  return id;
}

/** GET /tags?kind= */
export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const { kind } = parseQuery(event.queryStringParameters, ListQuerySchema);
    return success({ items: await tagService.list(userId, kind) });
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /tags */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, CreateSchema);
    return success(await tagService.create(userId, body.kind, body.name), 201);
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /tags/{id} */
export const updateHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, UpdateSchema);
    return success(await tagService.update(userId, getId(event), body));
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /tags/{id}（論理削除） */
export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    await tagService.delete(userId, getId(event));
    return success({ id: getId(event) });
  } catch (e) {
    return errorResponse(e);
  }
};
