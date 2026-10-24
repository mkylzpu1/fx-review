import type { TradeView } from "../../types/trade";
import { round } from "../trade/calc";

export type IncludeKey =
  "result" | "planDiff" | "rationale" | "ruleChecks" | "reflection" | "market";

export type Include = Record<IncludeKey, boolean>;

export const DEFAULT_INCLUDE: Include = {
  result: true,
  planDiff: true,
  rationale: true,
  ruleChecks: true,
  reflection: true,
  market: true,
};

export interface ExportContext {
  timezone: string;
  /** 曜日・セッション（表示タイムゾーンで計算済み） */
  marketOf: (iso: string) => { weekday: string; session: string };
  formatDate: (iso: string) => string;
}

export interface Column {
  header: string;
  group: IncludeKey | "base";
  /** 自由記述（CSVで式として解釈されないよう先頭を無害化する） */
  freeText?: boolean;
  value: (t: TradeView, c: ExportContext) => string | number | null;
}

const tags = (t: TradeView, kind: "rationale" | "emotion") =>
  t.tags
    .filter((x) => x.kind === kind)
    .map((x) => x.name)
    .join("|");

/** 列の定義。基本の列は常に出し、グループの列は include がONのときだけ出す */
export const COLUMNS: Column[] = [
  { header: "id", group: "base", value: (t) => t.id },
  {
    header: "日時JST",
    group: "base",
    value: (t, c) => c.formatDate(t.entryAt),
  },
  { header: "通貨ペア", group: "base", value: (t) => t.pair },
  { header: "方向", group: "base", value: (t) => t.side },
  { header: "エントリー", group: "base", value: (t) => t.entryPrice },

  { header: "決済価格", group: "result", value: (t) => t.exitPrice },
  {
    header: "決済方法",
    group: "result",
    value: (t) => (t.status === "closed" ? t.exitMethod : ""),
  },
  { header: "pips", group: "result", value: (t) => t.pips },
  { header: "R", group: "result", value: (t) => t.rMultiple },
  { header: "ロット", group: "result", value: (t) => t.lots },
  { header: "損益円", group: "result", value: (t) => t.pnlJpy },
  { header: "保有分", group: "result", value: (t) => t.holdMinutes },
  { header: "MFE_pips", group: "result", value: (t) => t.mfePips },
  { header: "MAE_pips", group: "result", value: (t) => t.maePips },
  {
    header: "決済後最大到達_pips",
    group: "result",
    value: (t) => t.afterMaxPips,
  },

  { header: "SL", group: "planDiff", value: (t) => t.slPrice },
  { header: "TP", group: "planDiff", value: (t) => t.tpPrice },
  { header: "計画RR", group: "planDiff", value: (t) => t.plannedRr },
  { header: "想定リスク円", group: "planDiff", value: (t) => t.riskJpy },
  { header: "想定リスク%", group: "planDiff", value: (t) => t.riskPct },
  {
    header: "SLの理由",
    group: "planDiff",
    freeText: true,
    value: (t) => t.slReason,
  },
  {
    header: "TPの理由",
    group: "planDiff",
    freeText: true,
    value: (t) => t.tpReason,
  },

  {
    header: "根拠タグ",
    group: "rationale",
    value: (t) => tags(t, "rationale"),
  },
  {
    header: "根拠メモ",
    group: "rationale",
    freeText: true,
    value: (t) => t.rationaleMemo,
  },

  {
    header: "ルール逸脱",
    group: "ruleChecks",
    value: (t) => (t.deviation ? "あり" : "なし"),
  },

  { header: "感情", group: "reflection", value: (t) => tags(t, "emotion") },
  { header: "確信度", group: "reflection", value: (t) => t.confidence },
  {
    header: "気づき",
    group: "reflection",
    freeText: true,
    value: (t) => t.insight,
  },
  {
    header: "次回のルール",
    group: "reflection",
    freeText: true,
    value: (t) => t.nextRule,
  },

  {
    header: "曜日",
    group: "market",
    value: (t, c) => c.marketOf(t.entryAt).weekday,
  },
  {
    header: "セッション",
    group: "market",
    value: (t, c) => c.marketOf(t.entryAt).session,
  },
];

export function activeColumns(include: Include): Column[] {
  return COLUMNS.filter((c) => c.group === "base" || include[c.group]);
}

/** CSVの1セル。カンマ・引用符・改行は引用符で囲む。自由記述は式として解釈される先頭文字を無害化する */
export function csvCell(v: string | number | null, freeText = false): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(round(v, 5)) : v;
  if (freeText && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  trades: TradeView[],
  include: Include,
  ctx: ExportContext,
): string {
  const cols = activeColumns(include);
  const lines = [cols.map((c) => csvCell(c.header)).join(",")];
  for (const t of trades) {
    lines.push(cols.map((c) => csvCell(c.value(t, ctx), c.freeText)).join(","));
  }
  return lines.join("\n");
}
