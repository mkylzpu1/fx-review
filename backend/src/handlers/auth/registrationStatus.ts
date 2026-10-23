import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { userStore } from "../../stores/userStore";

/** ユーザーの登録状態を返す（初回登録フロー用） */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = await verifyAuth(event);
    const user = await userStore.get(authUser.userId);

    return success({ registered: user !== null });
  } catch (e) {
    return errorResponse(e);
  }
};
