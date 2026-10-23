import { CognitoJwtVerifier } from "aws-jwt-verify";
import { APIGatewayProxyEvent } from "aws-lambda";
import { UnauthorizedError } from "./errors";
import { logger } from "./logger";

const IS_LOCAL = process.env.IS_LOCAL === "true";
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";

/** Cognitoの検証済みJWTペイロード型 */
interface CognitoPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/** verifyAuth の返却値 */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: COGNITO_USER_POOL_ID,
      tokenUse: "id",
      clientId: null, // クライアントIDは検証しない（複数クライアント対応）
    });
  }
  return verifier;
}

/**
 * リクエストのAuthorizationヘッダーからJWTを検証し、ユーザー情報を返す。
 * IS_LOCAL=true の場合はモックユーザーを返す（ローカル開発用）。
 */
export async function verifyAuth(event: APIGatewayProxyEvent): Promise<AuthUser> {
  if (IS_LOCAL) {
    logger.debug("IS_LOCAL=true: モックユーザーで認証をバイパス");
    return {
      userId: "local-user-id",
      email: "local@example.com",
      name: "Local User",
      picture: undefined,
    };
  }

  const authHeader =
    event.headers["Authorization"] ?? event.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Authorizationヘッダーがありません");
  }

  const token = authHeader.slice(7);

  try {
    const payload = (await getVerifier().verify(token)) as CognitoPayload;
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture,
    };
  } catch (e) {
    logger.warn("JWT検証失敗", { error: String(e) });
    throw new UnauthorizedError("トークンが無効です");
  }
}
