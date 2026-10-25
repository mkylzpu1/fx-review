/**
 * 評価用ファイルを見せるだけの、小さな Cloudflare Worker。
 *   GET /s/{ID} → KV（SHARES）から取り出して返す。24時間たつとKVが自動で消すので、そのあとは 404。
 * 書き込みはここでは受けない（書くのは手元の backend だけ。Cloudflare の API 経由）。
 */
const ID_RE = /^\/s\/([A-Za-z0-9_-]{16,64})$/;

const COMMON_HEADERS = {
  // 検索エンジンに載せない・保存させない
  "x-robots-tag": "noindex, nofollow, noarchive",
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

// 評価用ファイルは、自分の中のスクリプトとスタイルだけで動く。外へは何も取りにいかない
const PAGE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const MESSAGE_PAGE = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>見つかりません</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0E1116;color:#E6EAF0;font:15px/1.7 system-ui,sans-serif;text-align:center;padding:24px}</style></head><body><p>このリンクは、期限（24時間）が過ぎたか、存在しません。<br>必要なら、送ってくれた人にもう一度お願いしてください。</p></body></html>`;

function message(status) {
  return new Response(MESSAGE_PAGE, {
    status,
    headers: {
      ...COMMON_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { ...COMMON_HEADERS, allow: "GET, HEAD" },
      });
    }
    const m = ID_RE.exec(new URL(request.url).pathname);
    if (!m) return message(404);

    const html = await env.SHARES.get(m[1]);
    if (html === null) return message(404);

    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        ...COMMON_HEADERS,
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": PAGE_CSP,
      },
    });
  },
};
