import {
  holdMinutes,
  resultPips,
  rMultiple,
  riskJpy,
  riskPct,
  riskReward,
  slPips,
  tpPips,
} from "./calc";
import { judgeAuto } from "./ruleJudge";
import { computeMissing, isUnfilled } from "./unfilled";
import type {
  Rule,
  RuleResult,
  TradeRecord,
  TradeView,
} from "../../types/trade";

export interface ViewContext {
  pipSize: number;
  pipValueJpyPerLot: number;
  balanceJpy: number;
  maxRiskPct: number;
  /** ユーザーの全ルール（有効・無効とも） */
  rules: Rule[];
}

/** 保存値から導出値を計算して、APIが返す TradeView にする（純粋関数） */
export function buildTradeView(r: TradeRecord, ctx: ViewContext): TradeView {
  const sl = slPips(r.entryPrice, r.slPrice, ctx.pipSize);
  const tp = tpPips(r.entryPrice, r.tpPrice, ctx.pipSize);
  const pips =
    r.exitPrice === null
      ? null
      : resultPips(r.side, r.entryPrice, r.exitPrice, ctx.pipSize);
  const risk = riskJpy(sl, ctx.pipValueJpyPerLot, r.lots);
  const risk_pct = riskPct(risk, ctx.balanceJpy);

  const hasRationaleTag = r.tags.some((t) => t.kind === "rationale");
  const unfilledInput = {
    slPrice: r.slPrice,
    tpPrice: r.tpPrice,
    exitAt: r.exitAt,
    hasRationaleTag,
  };

  const ruleResults = judgeRules(r, ctx, risk_pct);
  const deviation = ruleResults.some((x) => x.isActive && x.result === "ng");

  return {
    ...r,
    pips,
    rMultiple: pips === null ? null : rMultiple(pips, sl),
    plannedRr: riskReward(sl, tp),
    riskJpy: risk,
    riskPct: risk_pct,
    holdMinutes: holdMinutes(r.entryAt, r.exitAt),
    ruleResults,
    deviation,
    isUnfilled: isUnfilled(unfilledInput),
    missing: computeMissing(unfilledInput),
  };
}

/**
 * ルールごとの判定。自動判定ルールは計算結果、それ以外は保存済みの手動チェック（無ければ na）。
 * 無効化したルールは、手動チェックが残っているものだけ過去の判定として返す。
 */
function judgeRules(
  r: TradeRecord,
  ctx: ViewContext,
  risk_pct: number | null,
): TradeView["ruleResults"] {
  const manual = new Map(r.ruleChecks.map((c) => [c.ruleId, c.result]));
  const out: TradeView["ruleResults"] = [];
  for (const rule of ctx.rules) {
    const stored = manual.get(rule.id);
    if (!rule.isActive && stored === undefined) continue;
    if (!rule.isActive && rule.autoKey) continue;

    let result: RuleResult;
    if (rule.autoKey) {
      result = judgeAuto(rule.autoKey, {
        hasSl: r.slPrice !== null,
        hasTp: r.tpPrice !== null,
        riskPct: risk_pct,
        maxRiskPct: ctx.maxRiskPct,
        exitMethod: r.exitMethod,
      });
    } else {
      result = stored ?? "na";
    }
    out.push({
      ruleId: rule.id,
      title: rule.title,
      result,
      isActive: rule.isActive,
    });
  }
  return out;
}
