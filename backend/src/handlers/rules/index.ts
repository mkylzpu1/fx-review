import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { ValidationError } from "../../lib/errors";
import { ruleService } from "../../services/rule/ruleService";

const AutoKeySchema = z.enum(["sl_set", "risk_within_limit", "hold_to_tp"]);
const TitleSchema = z
  .string()
  .trim()
  .min(1, "ルール名を入力してください")
  .max(100, "ルール名は100文字までです");
const DescriptionSchema = z.string().trim().max(500, "説明は500文字までです");

const CreateSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema.optional(),
  autoKey: AutoKeySchema.nullable().optional(),
  isActive: z.boolean().optional(),
});
const UpdateSchema = z.object({
  title: TitleSchema.optional(),
  description: DescriptionSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  autoKey: AutoKeySchema.nullable().optional(),
});

function getId(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.id;
  if (!id) throw new ValidationError("idが指定されていません");
  return id;
}

/** GET /rules */
export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success({ items: await ruleService.list(userId) });
  } catch (e) {
    return errorResponse(e);
  }
};

/** GET /rules/{id} */
export const getHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(await ruleService.detail(userId, getId(event)));
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /rules */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, CreateSchema);
    const created = await ruleService.create(userId, {
      title: body.title,
      description: body.description ?? "",
      autoKey: body.autoKey ?? null,
      isActive: body.isActive ?? true,
    });
    return success(created, 201);
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /rules/{id} */
export const updateHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, UpdateSchema);
    return success(await ruleService.update(userId, getId(event), body));
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /rules/{id} */
export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    await ruleService.delete(userId, getId(event));
    return success({ id: getId(event) });
  } catch (e) {
    return errorResponse(e);
  }
};
