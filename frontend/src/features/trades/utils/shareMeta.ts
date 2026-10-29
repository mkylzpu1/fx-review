/** ブラウザのタブに出す小さなアイコン（ページ内に持つ。公開ページは外の画像を読めないため） */
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0E1116"/><g stroke-linecap="round"><path d="M20 12v40" stroke="#6EE7C8" stroke-width="3"/><rect x="13" y="24" width="14" height="20" rx="2" fill="#6EE7C8"/><path d="M44 8v40" stroke="#FF7A8A" stroke-width="3"/><rect x="37" y="14" width="14" height="22" rx="2" fill="#FF7A8A"/></g></svg>';

const SITE_NAME = "とれみる";
const DESCRIPTION =
  "とれみるの評価用ファイルです。エントリーの計画とチャートを見られます。このリンクは24時間で自動的に消えます。";

/**
 * 公開ページの <head> に入れる、アイコンとリンクのプレビュー（LINE・Slack・Xなど）用のタグ。
 * {{ORIGIN}} と {{URL}} は、公開を受ける Cloudflare Worker が本物のURLに置き換える
 * （プレビューの画像は絶対URLでないと読まれないため）。
 * 題名は、呼び出し側でHTMLエスケープ済みのものを渡す。載せるのは題名と固定の説明だけ。損益額・口座・感情・振り返りの文は入れない。
 */
export function buildShareHeadMeta(escapedTitle: string): string {
  const t = escapedTitle;
  const d = DESCRIPTION;
  const icon = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
  return [
    `<meta name="description" content="${d}">`,
    `<meta name="robots" content="noindex, nofollow">`,
    `<meta name="theme-color" content="#0E1116">`,
    `<link rel="icon" type="image/svg+xml" href="${icon}">`,
    `<link rel="apple-touch-icon" href="{{ORIGIN}}/apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="{{URL}}">`,
    `<meta property="og:image" content="{{ORIGIN}}/og.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="{{ORIGIN}}/og.png">`,
  ].join("\n");
}
