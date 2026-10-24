import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { importService } from "../../services/import/importService";
import { CommitBodySchema, PreviewBodySchema } from "./schemas";

/** POST /imports/preview */
export const previewHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, PreviewBodySchema);
    return success(await importService.preview(userId, body.files));
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /imports/commit */
export const commitHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, CommitBodySchema);
    return success(
      await importService.commit(userId, body.files, body.duplicateMode),
    );
  } catch (e) {
    return errorResponse(e);
  }
};
