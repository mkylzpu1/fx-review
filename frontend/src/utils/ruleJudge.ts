import type { AutoKey, ExitMethod, RuleResult } from "@/features/trades/types";

export interface JudgeContext {
  hasSl: boolean;
  hasTp: boolean;
  /** 想定リスク%。SLが無いと null */
  riskPct: number | null;
  maxRiskPct: number;
  exitMethod: ExitMethod;
}

/**
 * 自動判定ルールの判定（指示書 §9.3 / §9.7）。
 * 必要な項目（SL・TP）が無いときは 'na'（逸脱に数えない）。
 */
export function judgeAuto(key: AutoKey, c: JudgeContext): RuleResult {
  switch (key) {
    case "sl_set":
      return c.hasSl ? "ok" : "na";
    case "risk_within_limit":
      if (c.riskPct === null) return "na";
      return c.riskPct <= c.maxRiskPct ? "ok" : "ng";
    case "hold_to_tp":
      if (!c.hasTp) return "na";
      if (c.exitMethod === "manual") return "ng";
      if (c.exitMethod === "tp") return "ok";
      return "na";
  }
}
