/**
 * 他の人に評価してもらうための、単体のHTMLファイルを作る（純粋関数）。
 * アプリ（認証・サーバー）に依存せず、ファイルを開くだけで、時間足とEMAを自由に切り替えられる。
 * 含めるのは相場の情報とトレード計画だけ。損益額・口座・感情タグ・振り返りの記述は含めない。
 */
import {
  CHART_COLORS,
  EMA_COLORS,
  SIDE_COLORS,
  SIDE_LABEL_JA,
} from "@/constants/chartTheme";
import type { EmaSetting, Timeframe } from "@/features/settings/types";
import {
  SIDE_LABEL,
  formatJst,
  formatPips,
  formatPrice,
  priceDigits,
} from "@/utils/format";
import type { Candle, Trade } from "../types";
import { excursionLevels, hasExcursion } from "./excursionLevels";
import { SHARE_PAGE_CSS, SHARE_PAGE_SCRIPT } from "./shareHtmlPage";
import { buildShareHeadMeta } from "./shareMeta";

export interface ShareFrame {
  tf: Timeframe;
  /** 先頭のウォームアップ（EMA計算用）の足の数 */
  warmupCount: number;
  candles: Candle[];
}

export interface ShareInput {
  trade: Trade;
  pipSize: number;
  frames: ShareFrame[];
  emas: EmaSetting[];
  /** 根拠のタグ・メモ・SL/TPの理由を含めるか */
  includeReasons: boolean;
  /** 最初に表示する時間足 */
  defaultTf: Timeframe;
  /** チャートの描画ライブラリ（standalone 版の中身） */
  librarySource: string;
}

const EXIT_LABEL = {
  open: "未決済",
  tp: "利確到達",
  sl: "損切り到達",
  manual: "手動決済",
  breakeven: "建値決済",
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** <script> の中に安全に埋め込める JSON にする */
export function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function row(label: string, value: string): string {
  return `<div class="row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

/** 「エントリー後を表示」にチェックを入れるまで隠す行 */
function afterRow(label: string, value: string): string {
  return `<div class="row after"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function reasonBlock(title: string, text: string | null): string {
  return text
    ? `<section class="blk"><h2>${escapeHtml(title)}</h2><p class="memo">${escapeHtml(text)}</p></section>`
    : "";
}

export function buildShareHtml(i: ShareInput): string {
  const t = i.trade;
  const p = (v: number | null) => formatPrice(v, i.pipSize);
  const tags = t.tags.filter((x) => x.kind === "rationale").map((x) => x.name);

  const slPips =
    t.slPrice === null ? null : Math.abs(t.entryPrice - t.slPrice) / i.pipSize;
  const tpPips =
    t.tpPrice === null ? null : Math.abs(t.tpPrice - t.entryPrice) / i.pipSize;
  const pipsText = (v: number | null, sign: "+" | "−") =>
    v === null ? "" : `（${sign}${v.toFixed(1)}）`;
  const rr =
    slPips !== null && tpPips !== null && slPips > 0
      ? (tpPips / slPips).toFixed(1)
      : null;

  const info = [
    row("エントリー", p(t.entryPrice)),
    row(
      "SL",
      t.slPrice === null
        ? "未設定"
        : `${p(t.slPrice)} ${pipsText(slPips, "−")}`.trim(),
    ),
    row(
      "TP",
      t.tpPrice === null
        ? "未設定"
        : `${p(t.tpPrice)} ${pipsText(tpPips, "+")}`.trim(),
    ),
    ...(rr === null ? [] : [row("RR", rr)]),
    ...(t.exitAt && t.exitPrice !== null
      ? [
          afterRow("決済", `${p(t.exitPrice)}  ${formatJst(t.exitAt)}`),
          afterRow("決済の種類", EXIT_LABEL[t.exitMethod]),
          afterRow("結果", formatPips(t.pips)),
        ]
      : [afterRow("決済", "未決済")]),
  ].join("");

  const reasonParts = i.includeReasons
    ? [
        tags.length > 0
          ? `<p class="tags">${tags.map((n) => `<span class="tag">${escapeHtml(n)}</span>`).join(" ")}</p>`
          : "",
        reasonBlock("根拠メモ", t.rationaleMemo),
        reasonBlock("損切りの理由", t.slReason),
        reasonBlock("利確の理由", t.tpReason),
      ].join("")
    : "";
  const reasons = reasonParts
    ? `<details class="why" open><summary>根拠・メモ</summary>${reasonParts}</details>`
    : "";

  const win =
    t.exitPrice === null
      ? false
      : t.side === "buy"
        ? t.exitPrice >= t.entryPrice
        : t.exitPrice <= t.entryPrice;
  const levels = excursionLevels(t, i.pipSize);
  const stamp = formatJst(t.entryAt).replace(/[/: ]/g, "");

  const data = {
    side: t.side,
    sideLabel: SIDE_LABEL_JA[t.side],
    defaultTf: i.defaultTf,
    pipSize: i.pipSize,
    digits: priceDigits(i.pipSize),
    entrySec: Math.floor(Date.parse(t.entryAt) / 1000),
    exitSec: t.exitAt ? Math.floor(Date.parse(t.exitAt) / 1000) : null,
    entryPrice: t.entryPrice,
    slPrice: t.slPrice,
    tpPrice: t.tpPrice,
    exitPrice: t.exitPrice,
    entryText: String(t.entryPrice),
    exitText: t.exitPrice === null ? null : String(t.exitPrice),
    exitWin: win,
    excursion: hasExcursion(levels) ? levels : null,
    imageName: `trade-${t.pair}-${stamp}`,
    colors: { ...CHART_COLORS, sideColor: SIDE_COLORS[t.side] },
    emaColors: EMA_COLORS,
    emas: i.emas.map((e) => ({ period: e.period, visible: e.visible })),
    frames: i.frames.map((f) => ({
      tf: f.tf,
      warmup: f.warmupCount,
      c: f.candles.map((c) => [c.time, c.open, c.high, c.low, c.close]),
    })),
  };

  const sideColor = SIDE_COLORS[t.side];
  const sideBadge = t.side === "buy" ? "▲ 買い" : "▼ 売り";
  const strip = [
    `<span>IN ${escapeHtml(p(t.entryPrice))}</span>`,
    `<span class="loss">SL ${t.slPrice === null ? "—" : escapeHtml(p(t.slPrice))}</span>`,
    `<span class="win">TP ${t.tpPrice === null ? "—" : escapeHtml(p(t.tpPrice))}</span>`,
    `<span class="mute">RR ${rr ?? "—"}</span>`,
  ].join("");
  const pageTitle = `${t.pair} ${SIDE_LABEL[t.side]} ${formatJst(t.entryAt)} のトレード`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(pageTitle)}</title>
${buildShareHeadMeta(escapeHtml(pageTitle))}
<style>${SHARE_PAGE_CSS}</style>
</head>
<body>
<header id="top">
  <div class="ttl"><span class="side" style="color:${sideColor}">${sideBadge}</span> <b>${escapeHtml(t.pair)}</b> <span class="mono mute">${escapeHtml(formatJst(t.entryAt))}</span></div>
  <div id="ctl-top" class="ctl"></div>
</header>
<div id="strip" class="strip mono">${strip}</div>
<div id="cvwrap">
  <div class="panes" id="panes"></div>
  <aside id="hud" class="hud" aria-label="計画">
    <div class="hudhead"><b>計画</b><button type="button" id="hudToggle" class="b" aria-label="計画を畳む・開く">▾</button></div>
    <div class="hudbody"><dl>${info}</dl>${reasons}</div>
  </aside>
</div>
<div id="bottom" class="bottom"></div>
<div id="ov" hidden></div>
<script>${i.librarySource}</script>
<script type="application/json" id="d">${safeJson(data)}</script>
<script>${SHARE_PAGE_SCRIPT}</script>
</body>
</html>`;
}
