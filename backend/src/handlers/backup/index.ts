import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseBody } from "../../lib/validate";
import { logger } from "../../lib/logger";
import {
  backupService,
  BackupFileSchema,
} from "../../services/backup/backupService";

/** GET /backup */
export const exportHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    return success(await backupService.export(userId));
  } catch (e) {
    return errorResponse(e);
  }
};

/** POST /backup/restore */
export const restoreHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    const body = parseBody(event.body, BackupFileSchema);
    logger.info("POST /backup/restore", { userId });
    return success(await backupService.restore(userId, body));
  } catch (e) {
    return errorResponse(e);
  }
};

/** DELETE /data */
export const deleteDataHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId } = await verifyAuth(event);
    logger.info("DELETE /data（全データ削除）", { userId });
    await backupService.deleteAll(userId);
    return success({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
};
