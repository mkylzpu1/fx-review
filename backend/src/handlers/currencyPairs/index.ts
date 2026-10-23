import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { ValidationError } from "../../lib/errors";
import { pairService } from "../../services/settings/pairService";

const CreateSchema = z.object({
  symbol: z
    .string()
    .regex(
      /^[A-Z]{6}$/,
      "通貨ペアは USDJPY のように大文字6文字で入力してください",
    ),
  pipSize: z.number().positive("pipの価格幅は0より大きくしてください"),
  pipValueJpyPerLot: z
    .number()
    .positive("1lot・1pipあたりの円は0より大きくしてください"),
  showInPicker: z.boolean(),
});

const UpdateSchema = CreateSchema.omit({ symbol: true }).partial();

function getId(event: APIGatewayProxyEvent): string {
  const id = event.pathParameters?.id;
  if (!id) throw new ValidationError("idが指定されていません");
  return id;
}

/** GET /currency-pairs */
export const listHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success({ items: await pairService.list(userId) });
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /currency-pairs */
export const createHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, CreateSchema);
    return success(await pairService.create(userId, body), 201);
  } catch (e) {
    return errorResponse(e);
  }
};

/** PUT /currency-pairs/{id} */
export const updateHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, UpdateSchema);
    return success(await pairService.update(userId, getId(event), body));
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /currency-pairs/{id} */
export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    await pairService.delete(userId, getId(event));
    return success({ id: getId(event) });
  } catch (e) {
    return errorResponse(e);
  }
};
