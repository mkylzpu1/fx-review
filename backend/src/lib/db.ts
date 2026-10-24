import postgres from "postgres";

const IS_LOCAL = process.env.IS_LOCAL === "true";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

/** 接続先が手元（localhost / 127.0.0.1）か。手元のDockerのPostgreSQLはSSLに対応していない */
function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const DISABLE_SSL = IS_LOCAL || isLocalHost(DATABASE_URL);

/**
 * PostgreSQL クライアントのシングルトン
 *
 * Lambda環境ではコールドスタート時に一度だけ初期化される。
 * ローカル環境（IS_LOCAL=true、または接続先が localhost）ではSSLを無効にする。
 * （IS_LOCAL が未設定でもローカルDBに TLS で接続しようとして
 *  「Client network socket disconnected before secure TLS connection was established」
 *  で失敗しないようにするため）
 */
export const sql = postgres(DATABASE_URL, {
  ssl: DISABLE_SSL ? false : { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
