import type { AutoKey } from "@/features/trades/types";

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
