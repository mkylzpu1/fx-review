import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { importService } from "../../services/import/importService";
import {
  detectOrderFiles,
  orderLinkService,
} from "../../services/import/orderLinkService";
import { CommitBodySchema, PreviewBodySchema } from "./schemas";

/** POST /imports/preview */
export const previewHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, PreviewBodySchema);
    // 注文履歴CSV（SL・TPの紐づけ）は約定履歴とは別の処理。ファイルの形で振り分ける
    if (detectOrderFiles(body.files))
      return success(await orderLinkService.preview(userId, body.files));
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
    if (detectOrderFiles(body.files))
      return success(await orderLinkService.commit(userId, body.files));
    return success(
      await importService.commit(userId, body.files, body.duplicateMode),
    );
  } catch (e) {
    return errorResponse(e);
  }
};
