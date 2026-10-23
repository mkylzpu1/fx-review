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
    logger.info("GET /auth/me", { userId: authUser.userId });

    const now = new Date().toISOString();

    let user = await userStore.get(authUser.userId);
    if (!user) {
      // 初回ログイン: ユーザーを作成
      user = {
        userId: authUser.userId,
        email: authUser.email,
        name: authUser.name,
        picture: authUser.picture,
        createdAt: now,
        updatedAt: now,
      };
      await userStore.create(user);
      logger.info("新規ユーザー作成", { userId: user.userId });
    } else {
      // プロフィール情報が変わっていれば同期
      const needsUpdate =
        user.name !== authUser.name || user.picture !== authUser.picture;
      if (needsUpdate) {
        await userStore.updateProfile(authUser.userId, {
          name: authUser.name,
          picture: authUser.picture,
          updatedAt: now,
        });
        user = { ...user, name: authUser.name, picture: authUser.picture };
      }
    }

    await userStore.updateLastLogin(authUser.userId, now);

    return success({
      userId: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
  } catch (e) {
    return errorResponse(e);
  }
};
