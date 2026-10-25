import { CANDLE_SYNC_URL } from "@/features/settings/hooks/useCandleSync";

export interface PublishedShare {
  /** 相手に送るURL */
  url: string;
  /** この日時を過ぎるとCloudflare側が自動で消す（ISO） */
  expiresAt: string;
}

/** 手元の同期サーバーに届かなかった（起動していない）ときのエラー */
export class ShareServerUnreachable extends Error {}

/**
 * 評価用のHTMLを、手元のサーバー経由でCloudflareに置き、見せるURLを受け取る。
 * 鍵（Cloudflareのトークン）は手元のサーバーにだけあり、画面側には渡さない。
 */
export async function publishShare(html: string): Promise<PublishedShare> {
  let res: Response;
  try {
    res = await fetch(`${CANDLE_SYNC_URL}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });
  } catch {
    throw new ShareServerUnreachable();
  }
  const json = (await res.json().catch(() => null)) as
    ({ ok: true } & PublishedShare) | { ok: false; message?: string } | null;
  if (!json || !json.ok)
    throw new Error(
      json && !json.ok && json.message ? json.message : "公開できませんでした",
    );
  return { url: json.url, expiresAt: json.expiresAt };
}
