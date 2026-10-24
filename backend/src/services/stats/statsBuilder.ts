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
  axis: "session" | "rationale" | "rule";
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
  insights: Insight[];
  /** 決済済みで集計に入ったトレード数 */
  closedCount: number;
}

interface Row extends StatTrade {
  hour: number;
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

  return {
    summary: summarize(rows),
    cumulative: points,
    drawdown: maxDrawdown(points),
    bySession,
    byRationale,
    byRule,
    insights: [
      ...toInsights("session", bySession),
      ...toInsights("rationale", byRationale),
      ...toInsights("rule", byRule),
    ],
    closedCount: rows.length,
  };
}
