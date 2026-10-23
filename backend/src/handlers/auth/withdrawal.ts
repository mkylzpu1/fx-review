import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { userStore } from "../../stores/userStore";
import { logger } from "../../lib/logger";

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = await verifyAuth(event);
    logger.info("DELETE /auth/me（退会）", { userId: authUser.userId });

    await userStore.delete(authUser.userId);

    return success({ message: "退会しました" });
  } catch (e) {
    return errorResponse(e);
  }
};
