import type { ExportFormat, ExportRange, Include, IncludeKey } from "../types";

export const RANGES: { value: ExportRange; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "30d", label: "直近30日" },
  { value: "month", label: "今月" },
];

export const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "markdown", label: "Markdown", hint: "AIに貼り付ける用（既定）" },
  { value: "csv", label: "CSV", hint: "トレード一覧のみ" },
  { value: "json", label: "JSON", hint: "全項目・他ツール連携用" },
];

export const INCLUDES: { key: IncludeKey; label: string; desc: string }[] = [
  {
    key: "result",
    label: "トレード結果",
    desc: "決済価格・pips・R・損益・保有時間・MFE/MAE",
  },
  {
    key: "planDiff",
    label: "計画と実際の差",
    desc: "SL・TP・計画RR・想定リスク・理由",
  },
  {
    key: "rationale",
    label: "エントリー根拠とタグ",
    desc: "根拠タグ・根拠メモ",
  },
  { key: "ruleChecks", label: "ルール遵守チェック", desc: "ルール逸脱の有無" },
  {
    key: "reflection",
    label: "振り返りメモ・感情タグ",
    desc: "感情・確信度・気づき・次回のルール",
  },
  { key: "market", label: "市場状況", desc: "曜日・セッション" },
];

export const DEFAULT_INCLUDE: Include = {
  result: true,
  planDiff: true,
  rationale: true,
  ruleChecks: true,
  reflection: true,
  market: true,
};

/** プレビューに出す最大文字数（コピー・ダウンロードは全文） */
export const PREVIEW_CHARS = 6000;
