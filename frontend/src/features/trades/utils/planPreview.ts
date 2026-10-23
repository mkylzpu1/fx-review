import {
  resultPips,
  rMultiple,
  riskJpy,
  riskPct,
  riskReward,
  slPips,
  tpPips,
} from "@/utils/tradeCalc";
import { judgeAuto } from "@/utils/ruleJudge";
import type { Rule } from "@/features/rules/types";
import type { AccountSettings, CurrencyPair } from "@/features/settings/types";
import { parseNum, type TradeFormState } from "./tradeForm";
import type { RuleResult } from "../types";

export interface PlanPreview {
  slPips: number | null;
  tpPips: number | null;
  rr: number | null;
  riskJpy: number | null;
  riskPct: number | null;
  /** 保存はできるが、設定の基準を外れているときの注意文 */
  warnings: string[];
  /** 決済価格が入っているときの結果の見込み */
  resultPips: number | null;
  resultR: number | null;
  autoResults: Record<string, RuleResult>;
}

const num = (s: string): number | null => {
  const v = parseNum(s);
  return v === null || Number.isNaN(v) ? null : v;
};

/** 入力途中のフォームから、想定リスク・RR・自動判定の見込みを計算する（保存前のプレビュー） */
export function buildPlanPreview(
  form: TradeFormState,
  pair: CurrencyPair | undefined,
  settings: AccountSettings | undefined,
  rules: Rule[],
): PlanPreview {
  const entry = num(form.entryPrice);
  const sl = num(form.slPrice);
  const tp = num(form.tpPrice);
  const exit = num(form.exitPrice);
  const lots = num(form.lots);
  const pipSize = pair?.pipSize ?? 0.01;

  const sp = entry === null ? null : slPips(entry, sl, pipSize);
  const tpp = entry === null ? null : tpPips(entry, tp, pipSize);
  const rr = riskReward(sp, tpp);
  const risk =
    pair && lots !== null ? riskJpy(sp, pair.pipValueJpyPerLot, lots) : null;
  const pct = settings ? riskPct(risk, settings.balanceJpy) : null;
  const rp =
    entry !== null && exit !== null
      ? resultPips(form.side, entry, exit, pipSize)
      : null;

  const warnings: string[] = [];
  if (settings && rr !== null && rr < settings.minRr) {
    warnings.push(
      `RRが設定の最低値（${settings.minRr}）より低くなっています。保存はできます。`,
    );
  }
  if (settings && pct !== null && pct > settings.maxRiskPct) {
    warnings.push(
      `想定リスクが設定の上限（${settings.maxRiskPct}%）を超えています。保存はできます。`,
    );
  }

  const autoResults: Record<string, RuleResult> = {};
  for (const r of rules) {
    if (!r.autoKey) continue;
    autoResults[r.id] = judgeAuto(r.autoKey, {
      hasSl: sl !== null,
      hasTp: tp !== null,
      riskPct: pct,
      maxRiskPct: settings?.maxRiskPct ?? 1,
      exitMethod: form.exitAt ? form.exitMethod || "manual" : "open",
    });
  }

  return {
    slPips: sp,
    tpPips: tpp,
    rr,
    riskJpy: risk,
    riskPct: pct,
    warnings,
    resultPips: rp,
    resultR: rp === null ? null : rMultiple(rp, sp),
    autoResults,
  };
}
