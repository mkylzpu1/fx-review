/**
 * ルール化した改善案の検証（指示書 §9.5）。ルール作成時に記録した validation_started_at 以降を「ルール後」とし、
 * 目標件数（既定10）に達したら前後の成績を比べる。
 */
import type { Rule, TradeView } from "../../types/trade";
import { round } from "../trade/calc";

export interface Avg {
  n: number;
  avgR: number | null;
}

export interface RuleValidation {
  ruleId: string;
  title: string;
  startedAt: string;
  /** ルール化後の決済済みトレード数 */
  count: number;
  target: number;
  /** 目標件数に達した（結果を見て判定できる） */
  reached: boolean;
  before: Avg;
  after: Avg;
  /** ルール後のうち、守った時・破った時 */
  kept: Avg;
  broken: Avg;
}

export function avg(views: TradeView[]): Avg {
  const rs = views.flatMap((v) => (v.rMultiple === null ? [] : [v.rMultiple]));
  return {
    n: rs.length,
    avgR:
      rs.length === 0
        ? null
        : round(rs.reduce((a, b) => a + b, 0) / rs.length, 2),
  };
}

export function validateRule(
  rule: Rule,
  views: TradeView[],
): RuleValidation | null {
  if (!rule.validationStartedAt) return null;
  const started = Date.parse(rule.validationStartedAt);
  const closed = views.filter((v) => v.status === "closed" && v.pips !== null);
  const before = closed.filter((v) => Date.parse(v.entryAt) < started);
  const after = closed.filter((v) => Date.parse(v.entryAt) >= started);
  const resultOf = (v: TradeView) =>
    v.ruleResults.find((r) => r.ruleId === rule.id)?.result;
  return {
    ruleId: rule.id,
    title: rule.title,
    startedAt: rule.validationStartedAt,
    count: after.length,
    target: rule.validationTargetN,
    reached: after.length >= rule.validationTargetN,
    before: avg(before),
    after: avg(after),
    kept: avg(after.filter((v) => resultOf(v) === "ok")),
    broken: avg(after.filter((v) => resultOf(v) === "ng")),
  };
}
