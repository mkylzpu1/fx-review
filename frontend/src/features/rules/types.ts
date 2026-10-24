import type { AutoKey } from "@/features/trades/types";
import type { RuleValidation } from "@/features/notes/types";

/** バックエンド GET /rules と対応 */
export interface Rule {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  autoKey: AutoKey | null;
  validationTargetN: number;
  validationStartedAt: string | null;
}

export interface RuleInput {
  title: string;
  description: string;
  autoKey: AutoKey | null;
}

/** 自動判定の種類（それ以外は手動チェック） */
export const AUTO_KEY_LABEL: Record<AutoKey, string> = {
  sl_set: "SLの有無で自動判定",
  risk_within_limit: "リスクが上限%以内か自動判定",
  hold_to_tp: "計画のTPまで保持したか自動判定",
};

/** バックエンド GET /rules/{id}（services/rule/ruleDetailCalc.ts）と対応 */
export interface Avg {
  n: number;
  avgR: number | null;
}

export interface ComplianceWeek {
  weekStart: string;
  kept: number;
  broke: number;
  /** 判定のある週が無ければ null */
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
  kept: number;
  broke: number;
  recent: { weeks: number; kept: number; broke: number; rate: number | null };
  avgKept: Avg;
  avgBroken: Avg;
  weekly: ComplianceWeek[];
  brokenTrades: BrokenTrade[];
  brokenTotal: number;
  validation: RuleValidation | null;
}
