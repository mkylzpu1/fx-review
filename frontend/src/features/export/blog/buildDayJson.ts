import type { Trade } from "@/features/trades/types";
import {
  CHART_TFS,
  SCHEMA_VERSION,
  type BlogWarning,
  type ChartTf,
  type DayBundle,
  type DaySummary,
  type Manifest,
  type TradeBundle,
} from "./bundleSchema";
import { localDateTime } from "./dateUtils";
import { groupByDay, type GroupOptions } from "./groupByDay";

/** 1枚の画像の結果。path が null のときは、その理由を warnings にする */
export type ChartOutcome =
  | { path: string }
  | { path: null; reason: "candles_missing" | "image_failed"; detail?: string };

/** トレードID → 時間足ごとの結果。キーが無い時間足は「作っていない」（警告なし・null） */
export type ChartOutcomes = ReadonlyMap<
  string,
  Partial<Record<ChartTf, ChartOutcome>>
>;

export interface BuildOptions extends GroupOptions {
  charts?: ChartOutcomes;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ファイル名に使えない文字を除く（通貨ペア名 USDJPY などはそのまま） */
const safeName = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_");

/** day.json からの相対パス（例: charts/01_USDJPY_1m.png） */
export function chartRelPath(seq: number, pair: string, tf: ChartTf): string {
  return `charts/${pad2(seq)}_${safeName(pair)}_${tf}.png`;
}

const blank = (s: string | null) => s === null || s.trim() === "";

/**
 * 日のまとめ。統計画面・一覧と同じ基準（summarize）で、
 * 「決済済みでpipsが出ているもの」を数え、勝ちはpipsが正のもの。
 * ただし契約どおり丸めない。
 */
export function summarizeDay(trades: readonly Trade[]): DaySummary {
  const closed = trades.filter((t) => t.status === "closed" && t.pips !== null);
  const wins = closed.filter((t) => (t.pips ?? 0) > 0).length;
  const rs = closed.flatMap((t) => (t.rMultiple === null ? [] : [t.rMultiple]));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    tradeCount: trades.length,
    closedCount: closed.length,
    wins,
    losses: closed.length - wins,
    winRatePct: closed.length === 0 ? null : (wins / closed.length) * 100,
    totalPips: closed.length === 0 ? null : sum(closed.map((t) => t.pips ?? 0)),
    totalPnlJpy:
      closed.length === 0 ? null : sum(closed.map((t) => t.pnlJpy ?? 0)),
    avgR: rs.length === 0 ? null : sum(rs) / rs.length,
    ruleDeviationCount: trades.filter((t) => t.deviation).length,
  };
}

/** 契約にある項目だけを取り出す（残高・ID・メール・取り込み元などは、ここで落ちる） */
function toTradeBundle(
  t: Trade,
  seq: number,
  tz: string,
  outcomes: Partial<Record<ChartTf, ChartOutcome>> | undefined,
): TradeBundle {
  const charts = {
    "1m": null,
    "15m": null,
    "1h": null,
  } as TradeBundle["charts"];
  for (const tf of CHART_TFS) {
    const o = outcomes?.[tf];
    charts[tf] = o && o.path !== null ? o.path : null;
  }
  return {
    seq,
    pair: t.pair,
    side: t.side,
    lots: t.lots,
    status: t.status,
    entryAt: t.entryAt,
    entryAtLocal: localDateTime(t.entryAt, tz),
    exitAt: t.exitAt,
    exitAtLocal: t.exitAt ? localDateTime(t.exitAt, tz) : null,
    holdingMinutes: t.holdMinutes,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    slPrice: t.slPrice,
    tpPrice: t.tpPrice,
    exitMethod: t.exitMethod,
    pips: t.pips,
    pnlJpy: t.pnlJpy,
    rMultiple: t.rMultiple,
    confidence: t.confidence,
    rationaleMemo: t.rationaleMemo,
    slReason: t.slReason,
    tpReason: t.tpReason,
    insight: t.insight,
    nextRule: t.nextRule,
    tags: t.tags.map((x) => x.name),
    ruleChecks: t.ruleResults.map((r) => ({ rule: r.title, result: r.result })),
    charts,
  };
}

function tradeWarnings(
  t: Trade,
  date: string,
  seq: number,
  outcomes: Partial<Record<ChartTf, ChartOutcome>> | undefined,
): BlogWarning[] {
  const w: BlogWarning[] = [];
  const add = (code: BlogWarning["code"], message: string) =>
    w.push({ date, seq, code, message });
  if (t.status === "open") add("open_trade", "未決済のトレードです。");
  if (blank(t.rationaleMemo))
    add("memo_missing", "エントリー根拠のメモが未入力です。");
  for (const tf of CHART_TFS) {
    const o = outcomes?.[tf];
    if (!o || o.path !== null) continue;
    add(
      o.reason,
      o.reason === "candles_missing"
        ? `${tf}足のローソク足がないため、画像を作っていません。`
        : `${tf}足の画像を作れませんでした。${o.detail ?? ""}`.trim(),
    );
  }
  return w;
}

export interface BuiltBundles {
  days: DayBundle[];
  warnings: BlogWarning[];
}

/** トレード一覧 → 日ごとの DayBundle と警告。副作用なしの純関数 */
export function buildDayBundles(
  trades: readonly Trade[],
  o: BuildOptions,
): BuiltBundles {
  const warnings: BlogWarning[] = [];
  const days = groupByDay(trades, o).map(({ date, trades: list }) => {
    const bundles = list.map((t, i) => {
      const seq = i + 1;
      const outcomes = o.charts?.get(t.id);
      warnings.push(...tradeWarnings(t, date, seq, outcomes));
      return toTradeBundle(t, seq, o.timeZone, outcomes);
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      date,
      timezone: o.timeZone,
      summary: summarizeDay(list),
      trades: bundles,
    } satisfies DayBundle;
  });
  return { days, warnings };
}

export function buildManifest(
  built: BuiltBundles,
  o: {
    timeZone: string;
    from: string;
    to: string;
    includeOpen: boolean;
    generatedAt?: Date;
  },
): Manifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: (o.generatedAt ?? new Date()).toISOString(),
    timezone: o.timeZone,
    range: { from: o.from, to: o.to },
    days: built.days.map((d) => d.date),
    includesOpenTrades: o.includeOpen,
    warnings: built.warnings,
  };
}

/** UTF-8・LF・2スペースインデント。末尾に改行を1つ付ける */
export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
