/**
 * ルール詳細（指示書 §7）の計算（純粋関数）。
 * 遵守率 = 守った ÷（守った + 破った）。判定なし（na・未入力）は分母に入れない（§9.7）。
 */
import {
  RULE_DETAIL_BROKEN_LIMIT,
  RULE_DETAIL_RECENT_WEEKS,
  RULE_DETAIL_WEEKS,
} from "../../constants/stats";
import type { Rule, RuleResult, TradeView } from "../../types/trade";
import { round } from "../trade/calc";
import {
  avg,
  validateRule,
  type Avg,
  type RuleValidation,
} from "../note/validationCalc";
import { addDays, jstDate, mondayOf } from "../weekly/weeklyCalc";

export interface ComplianceWeek {
  weekStart: string;
  kept: number;
  broke: number;
  /** 判定のあるトレードが無い週は null */
  rate: number | null;
}

export interface BrokenTrade {
  id: string;
  entryAt: string;
  side: "buy" | "sell";
  pips: number | null;
  rMultiple: number | null;
  pnlJpy: number | null;
}

export interface RuleDetail {
  rule: Rule;
  /** 判定のあるトレード全体（守った・破った） */
  kept: number;
  broke: number;
  /** 直近 RULE_DETAIL_RECENT_WEEKS 週 */
  recent: { weeks: number; kept: number; broke: number; rate: number | null };
  /** 守った時・破った時の平均R（全期間。Rが計算できるものだけ） */
  avgKept: Avg;
  avgBroken: Avg;
  /** 古い週 → 新しい週。今週を含む */
  weekly: ComplianceWeek[];
  brokenTrades: BrokenTrade[];
  brokenTotal: number;
  /** ルール化した改善案なら、前後の成績の比較 */
  validation: RuleValidation | null;
}

const rateOf = (kept: number, broke: number): number | null =>
  kept + broke === 0 ? null : round((kept / (kept + broke)) * 100, 1);

export function buildRuleDetail(
  rule: Rule,
  views: TradeView[],
  today: string,
): RuleDetail {
  const closed = views.filter((v) => v.status === "closed" && v.pips !== null);
  const judged = closed.flatMap((v) => {
    const result: RuleResult | undefined = v.ruleResults.find(
      (r) => r.ruleId === rule.id,
    )?.result;
    return result === "ok" || result === "ng" ? [{ view: v, result }] : [];
  });
  const keptViews = judged.filter((j) => j.result === "ok").map((j) => j.view);
  const brokenViews = judged
    .filter((j) => j.result === "ng")
    .map((j) => j.view);

  const thisMonday = mondayOf(today);
  const weekly: ComplianceWeek[] = Array.from(
    { length: RULE_DETAIL_WEEKS },
    (_, i) => {
      const weekStart = addDays(thisMonday, (i - (RULE_DETAIL_WEEKS - 1)) * 7);
      return { weekStart, kept: 0, broke: 0, rate: null };
    },
  );
  for (const j of judged) {
    const week = weekly.find(
      (w) => w.weekStart === mondayOf(jstDate(j.view.entryAt)),
    );
    if (!week) continue;
    if (j.result === "ok") week.kept += 1;
    else week.broke += 1;
  }
  for (const w of weekly) w.rate = rateOf(w.kept, w.broke);

  const recentWeeks = weekly.slice(-RULE_DETAIL_RECENT_WEEKS);
  const recentKept = recentWeeks.reduce((a, w) => a + w.kept, 0);
  const recentBroke = recentWeeks.reduce((a, w) => a + w.broke, 0);

  return {
    rule,
    kept: keptViews.length,
    broke: brokenViews.length,
    recent: {
      weeks: RULE_DETAIL_RECENT_WEEKS,
      kept: recentKept,
      broke: recentBroke,
      rate: rateOf(recentKept, recentBroke),
    },
    avgKept: avg(keptViews),
    avgBroken: avg(brokenViews),
    weekly,
    brokenTrades: [...brokenViews]
      .sort((a, b) => Date.parse(b.entryAt) - Date.parse(a.entryAt))
      .slice(0, RULE_DETAIL_BROKEN_LIMIT)
      .map((v) => ({
        id: v.id,
        entryAt: v.entryAt,
        side: v.side,
        pips: v.pips,
        rMultiple: v.rMultiple,
        pnlJpy: v.pnlJpy,
      })),
    brokenTotal: brokenViews.length,
    validation: validateRule(rule, views),
  };
}
