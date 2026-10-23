import type { AuthUser } from "./types";

/**
 * ローカル開発用の固定ユーザー認証。
 * Backend の verifyAuth（IS_LOCAL=true）が返すユーザーと同じ値にする。
 * 開発ビルド（import.meta.env.DEV）かつ VITE_LOCAL_AUTH=true のときだけ有効。
 */
export const IS_LOCAL_AUTH = import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTH === "true";

export const LOCAL_USER: AuthUser = {
  userId: "local-user-id",
  email: "local@example.com",
  name: "Local User",
};

/** 本番ビルドで VITE_LOCAL_AUTH=true が設定されていたら起動時に失敗させる */
export function assertLocalAuthSafe(): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTH === "true") {
    throw new Error("VITE_LOCAL_AUTH は本番ビルドでは使用できません");
  }
}
