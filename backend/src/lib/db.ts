import postgres from "postgres";

const IS_LOCAL = process.env.IS_LOCAL === "true";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

/**
 * PostgreSQL クライアントのシングルトン
 *
 * Lambda環境ではコールドスタート時に一度だけ初期化される。
 * ローカル環境（IS_LOCAL=true）ではSSLを無効にする。
 */
export const sql = postgres(DATABASE_URL, {
  ssl: IS_LOCAL ? false : { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
