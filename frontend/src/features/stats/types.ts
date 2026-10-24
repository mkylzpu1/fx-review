/** バックエンド services/stats/statsBuilder.ts のレスポンスと対応 */
export type Verdict = "strength" | "weakness" | "needs_check";

export interface Summary {
  n: number;
  winRate: number | null;
  totalPips: number;
  totalPnlJpy: number;
  rCount: number;
  rMissing: number;
  avgR: number | null;
  totalR: number;
  profitFactor: number | null;
  maxLossStreak: number;
}

export interface CumulativePoint {
  index: number;
  entryAt: string;
  r: number;
  cumulative: number;
}

export interface Drawdown {
  depth: number;
  peakIndex: number;
  troughIndex: number;
}

export interface GroupStat {
  key: string;
  label: string;
  n: number;
  avgR: number | null;
  verdict: Verdict;
  shortfall: number;
}

export interface Insight {
  kind: Verdict;
  axis: "session" | "rationale" | "rule";
  label: string;
  n: number;
  avgR: number | null;
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
  closedCount: number;
}

export type PeriodKey = "90d" | "30d" | "month" | "all";
