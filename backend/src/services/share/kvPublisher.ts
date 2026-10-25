/**
 * 評価用のHTMLを、Cloudflare Workers KV に「24時間で自動的に消える」設定で保存し、見せるURLを返す。
 * 鍵（APIトークン）は手元の backend/.env.local にだけ置く。AWSのLambdaでは動かさない（手元の同期サーバー用）。
 *
 * 見せる側は cloudflare/share-worker（KVから取り出して返す小さなWorker）。URLは「{SHARE_BASE_URL}/s/{ランダムなID}」。
 */
import { randomBytes } from "node:crypto";

export const SHARE_TTL_SECONDS = 24 * 60 * 60;
/** KVの1つの値は25MiBまで。評価ファイルは数百KBなので、異常に大きいものだけ止める */
export const MAX_HTML_BYTES = 8 * 1024 * 1024;

export interface ShareConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  /** Worker のURL（末尾のスラッシュなし）。例: https://fx-share.example.workers.dev */
  baseUrl: string;
}

export interface PublishResult {
  url: string;
  /** この日時を過ぎると、KVが自動で消す */
  expiresAt: string;
}

/** 公開の設定が足りない（.env.local に書かれていない）とき */
export class ShareNotConfigured extends Error {}
/** 保存の依頼が通らなかった（Cloudflare側のエラー） */
export class ShareUploadFailed extends Error {}

export const SHARE_ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_KV_NAMESPACE_ID",
  "CF_API_TOKEN",
  "SHARE_BASE_URL",
] as const;

/** 環境変数から設定を読む。足りないものがあれば null */
export function loadShareConfig(
  env: Record<string, string | undefined> = process.env,
): ShareConfig | null {
  const v = (k: string) => (env[k] ?? "").trim();
  if (SHARE_ENV_KEYS.some((k) => !v(k))) return null;
  return {
    accountId: v("CF_ACCOUNT_ID"),
    namespaceId: v("CF_KV_NAMESPACE_ID"),
    apiToken: v("CF_API_TOKEN"),
    baseUrl: v("SHARE_BASE_URL").replace(/\/+$/, ""),
  };
}

/** 推測されにくいID（24バイト＝192ビットの乱数。URLに使える文字だけ） */
export function newShareId(): string {
  return randomBytes(24).toString("base64url");
}

export async function publishHtml(
  html: string,
  cfg: ShareConfig,
  deps: {
    fetchFn?: typeof fetch;
    now?: () => Date;
    newId?: () => string;
  } = {},
): Promise<PublishResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  const id = (deps.newId ?? newShareId)();

  if (!/^\s*<!doctype html/i.test(html))
    throw new ShareUploadFailed("評価用のHTMLではありません");
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES)
    throw new ShareUploadFailed("ファイルが大きすぎます");

  // KV の「値の書き込み」API。expiration_ttl（秒）を付けると、その時間が過ぎたら自動で消える
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}` +
    `/storage/kv/namespaces/${encodeURIComponent(cfg.namespaceId)}` +
    `/values/${encodeURIComponent(id)}?expiration_ttl=${SHARE_TTL_SECONDS}`;

  const form = new FormData();
  form.append("value", html);
  form.append("metadata", "{}");

  let res: Response;
  try {
    res = await fetchFn(endpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
      body: form,
    });
  } catch {
    throw new ShareUploadFailed(
      "Cloudflareに接続できませんでした。ネットワークを確認してください",
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as {
        errors?: { message?: string }[];
      };
      detail = json.errors?.[0]?.message ?? "";
    } catch {
      // 本文が読めなくても、ステータスだけで伝える
    }
    throw new ShareUploadFailed(
      res.status === 401 || res.status === 403
        ? "Cloudflareの鍵（APIトークン）が使えません。権限と有効期限を確認してください"
        : `Cloudflareへの保存に失敗しました（${res.status}${detail ? `: ${detail}` : ""}）`,
    );
  }

  return {
    url: `${cfg.baseUrl}/s/${id}`,
    expiresAt: new Date(
      now().getTime() + SHARE_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}
