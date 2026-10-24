/** バックエンド services/weekly/weeklyCalc.ts・weeklyService.ts のレスポンスと対応 */
export interface DayStat {
  date: string;
  n: number;
  r: number;
  rCount: number;
}

export interface WeeklyTrade {
  id: string;
  entryAt: string;
  side: "buy" | "sell";
  pips: number | null;
  rMultiple: number | null;
  pnlJpy: number | null;
  deviation: boolean;
}

export interface PlannedComparison {
  eligibleCount: number;
  excludedCount: number;
  actualR: number;
  plannedTotalR: number;
  diffR: number;
  emotions: { name: string; n: number }[];
}

export interface WeeklyComment {
  kind: "strength" | "weakness" | "note";
  text: string;
}

export interface WeeklyReviewSaved {
  weekStart: string;
  memo: string;
  nextRuleId: string | null;
  nextRuleText: string | null;
}

export interface WeeklyResult {
  weekStart: string;
  weekEnd: string;
  n: number;
  winRate: number | null;
  totalR: number;
  rCount: number;
  rMissing: number;
  totalPips: number;
  rule: { kept: number; broke: number; none: number };
  days: DayStat[];
  planned: PlannedComparison;
  trades: WeeklyTrade[];
  comments: WeeklyComment[];
  fewTrades: boolean;
  review: WeeklyReviewSaved | null;
  rules: { id: string; title: string }[];
}

export interface WeeklySaveBody {
  memo: string;
  nextRuleId: string | null;
  nextRuleText: string | null;
}
