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

/** 手元から来たリクエストのHostとして認めるもの（ポート番号は無視する） */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * IS_LOCAL=true（認証を省くモード）を使ってよい状況かを確かめる。使えないときは例外を投げる。
 *
 * 守りは2つ:
 * 1. 本物のAWS Lambda上（sam local ではない）では、IS_LOCAL=true でも認証を省かない。
 *    設定ミスで本番が「誰でも入れる」状態になるのを防ぐ。
 * 2. Hostヘッダーが手元のもの（localhost など）でなければ拒否する。
 *    悪意のあるサイトが自分のドメインを 127.0.0.1 に向けて手元のAPIを呼ぶ
 *    「DNSリバインディング」を防ぐ。Hostが無い（テストなどで直接呼ぶ）場合は通す。
 */
export function assertLocalModeAllowed(
  env: NodeJS.ProcessEnv,
  hostHeader: string | undefined,
): void {
  const onRealLambda =
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME) && env.AWS_SAM_LOCAL !== "true";
  if (onRealLambda) {
    logger.error(
      "本物のLambda上で IS_LOCAL=true が設定されています。拒否します",
    );
    throw new UnauthorizedError("認証設定が不正です");
  }
  if (hostHeader) {
    const host = hostHeader.toLowerCase().replace(/:\d+$/, "");
    if (!LOCAL_HOSTS.has(host)) {
      logger.warn("IS_LOCAL: 手元以外のHostからのリクエストを拒否", { host });
      throw new UnauthorizedError("手元（localhost）からのみ利用できます");
    }
  }
}

/**
 * リクエストのAuthorizationヘッダーからJWTを検証し、ユーザー情報を返す。
 * IS_LOCAL=true の場合はモックユーザーを返す（ローカル開発用）。
 */
export async function verifyAuth(
  event: APIGatewayProxyEvent,
): Promise<AuthUser> {
  if (IS_LOCAL) {
    assertLocalModeAllowed(
      process.env,
      event.headers?.["Host"] ?? event.headers?.["host"],
    );
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
    const payload = (await getVerifier().verify(
      token,
    )) as unknown as CognitoPayload;
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
