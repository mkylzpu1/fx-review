/**
 * 統計画面の集計をまとめる（純粋関数）。
 * 根拠タグ別・ルール遵守別は、タグ・判定のあるトレードだけで出し、無いものは「未入力」にまとめる（§9.7）。
 */
import { OTHER_SESSION, SESSIONS } from "../../constants/sessions";
import type { TradeView } from "../../types/trade";
import {
  cumulativeR,
  groupBy,
  hourInZone,
  maxDrawdown,
  sessionOf,
  summarize,
  weekdayInZone,
  type CumulativePoint,
  type Drawdown,
  type GroupStat,
  type StatTrade,
  type Summary,
} from "./statsCalc";

export const UNSET_KEY = "__unset__";

export interface Insight {
  kind: "strength" | "weakness" | "needs_check";
  /** どの切り口か */
  axis:
    "session" | "rationale" | "rule" | "weekday" | "hour" | "holding" | "lots";
  label: string;
  n: number;
  avgR: number | null;
  /** 要検証のとき、あと何件ほどで判断できるか */
  shortfall: number;
}

export interface StatsResult {
  summary: Summary;
  cumulative: CumulativePoint[];
  drawdown: Drawdown | null;
  bySession: GroupStat[];
  byRationale: GroupStat[];
  byRule: GroupStat[];
  byWeekday: GroupStat[];
  byHour: GroupStat[];
  byHolding: GroupStat[];
  byLots: GroupStat[];
  insights: Insight[];
  /** 決済済みで集計に入ったトレード数 */
  closedCount: number;
}

interface Row extends StatTrade {
  hour: number;
  weekday: number;
  holdMinutes: number | null;
  lots: number | null;
  rationaleTags: string[];
  ruleKey: "ok" | "ng" | "none";
}

function ruleKeyOf(v: TradeView): Row["ruleKey"] {
  const active = v.ruleResults.filter((r) => r.isActive);
  if (active.some((r) => r.result === "ng")) return "ng";
  if (active.some((r) => r.result === "ok")) return "ok";
  return "none";
}

export function toRows(views: TradeView[], timezone: string): Row[] {
  return views
    .filter((v) => v.status === "closed" && v.pips !== null)
    .map((v) => ({
      entryAt: v.entryAt,
      pips: v.pips,
      rMultiple: v.rMultiple,
      pnlJpy: v.pnlJpy,
      hour: hourInZone(v.entryAt, timezone),
      weekday: weekdayInZone(v.entryAt, timezone),
      holdMinutes: v.holdMinutes ?? null,
      lots: v.lots ?? null,
      rationaleTags: v.tags
        .filter((t) => t.kind === "rationale")
        .map((t) => t.name),
      ruleKey: ruleKeyOf(v),
    }));
}

function toInsights(axis: Insight["axis"], groups: GroupStat[]): Insight[] {
  return groups
    .filter((g) => g.key !== UNSET_KEY && g.key !== "none")
    .map((g) => ({
      kind: g.verdict,
      axis,
      label: g.label,
      n: g.n,
      avgR: g.avgR,
      shortfall: g.shortfall,
    }));
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
/** 月〜金を先頭に、土日は後ろ */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const HOLDING_BANDS = [
  { key: "lt5", label: "5分未満", max: 5 },
  { key: "lt30", label: "5〜30分", max: 30 },
  { key: "lt120", label: "30分〜2時間", max: 120 },
  { key: "lt480", label: "2〜8時間", max: 480 },
  { key: "ge480", label: "8時間以上", max: Infinity },
];

export function holdingKeyOf(minutes: number | null): string | null {
  if (minutes === null) return null;
  return HOLDING_BANDS.find((b) => minutes < b.max)?.key ?? null;
}

const LOT_BANDS = [
  { key: "lt1", label: "1ロット未満", max: 1 },
  { key: "lt3", label: "1〜3ロット未満", max: 3 },
  { key: "ge3", label: "3ロット以上", max: Infinity },
];

export function lotKeyOf(lots: number | null): string | null {
  if (lots === null) return null;
  return LOT_BANDS.find((b) => lots < b.max)?.key ?? null;
}

export function buildStats(views: TradeView[], timezone: string): StatsResult {
  const rows = toRows(views, timezone);
  const points = cumulativeR(rows);

  const bySession = groupBy(
    rows,
    (r) => [sessionOf(r.hour).key],
    [...SESSIONS, OTHER_SESSION].map((s) => ({ key: s.key, label: s.label })),
  );

  const tagNames = [...new Set(rows.flatMap((r) => r.rationaleTags))].sort();
  const byRationale = groupBy(
    rows,
    (r) => (r.rationaleTags.length === 0 ? [UNSET_KEY] : r.rationaleTags),
    [
      ...tagNames.map((n) => ({ key: n, label: n })),
      { key: UNSET_KEY, label: "未入力" },
    ],
  );

  const byRule = groupBy(rows, (r) => [r.ruleKey], [
    { key: "ok", label: "ルールを守った" },
    { key: "ng", label: "ルールを破った" },
    { key: "none", label: "判定なし" },
  ]);

  const byWeekday = groupBy(
    rows,
    (r) => [String(r.weekday)],
    WEEKDAY_ORDER.map((d) => ({
      key: String(d),
      label: `${WEEKDAY_LABELS[d]}曜`,
    })),
  );
  const byHour = groupBy(
    rows,
    (r) => [String(r.hour)],
    Array.from({ length: 24 }, (_, h) => ({
      key: String(h),
      label: `${h}時台`,
    })),
  );
  const byHolding = groupBy(
    rows,
    (r) => {
      const k = holdingKeyOf(r.holdMinutes);
      return k === null ? [] : [k];
    },
    HOLDING_BANDS.map((b) => ({ key: b.key, label: b.label })),
  );
  const byLots = groupBy(
    rows,
    (r) => {
      const k = lotKeyOf(r.lots);
      return k === null ? [] : [k];
    },
    LOT_BANDS.map((b) => ({ key: b.key, label: b.label })),
  );

  return {
    summary: summarize(rows),
    cumulative: points,
    drawdown: maxDrawdown(points),
    bySession,
    byRationale,
    byRule,
    byWeekday,
    byHour,
    byHolding,
    byLots,
    insights: [
      ...toInsights("session", bySession),
      ...toInsights("rationale", byRationale),
      ...toInsights("rule", byRule),
      ...toInsights("weekday", byWeekday),
      ...toInsights("hour", byHour),
      ...toInsights("holding", byHolding),
      ...toInsights("lots", byLots),
    ],
    closedCount: rows.length,
  };
}
