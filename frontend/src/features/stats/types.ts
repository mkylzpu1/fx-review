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

/** エントリー日ごとの成績と累積（取引のあった日だけ・古い順）。backend の DailyPoint */
export interface DailyPoint {
  /** エントリー日（表示タイムゾーン・YYYY-MM-DD） */
  date: string;
  n: number;
  wins: number;
  pips: number;
  pnlJpy: number;
  r: number;
  /** R が計算できた件数（0 の日は R が「—」） */
  rCount: number;
  cumulativePips: number;
  cumulativePnlJpy: number;
  cumulativeR: number;
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
  axis:
    "session" | "rationale" | "rule" | "weekday" | "hour" | "holding" | "lots";
  label: string;
  n: number;
  avgR: number | null;
  shortfall: number;
}

export interface StatsResult {
  summary: Summary;
  cumulative: CumulativePoint[];
  drawdown: Drawdown | null;
  /** 古いAPIでは無いことがある */
  daily?: DailyPoint[];
  bySession: GroupStat[];
  byRationale: GroupStat[];
  byRule: GroupStat[];
  byWeekday: GroupStat[];
  byHour: GroupStat[];
  byHolding: GroupStat[];
  byLots: GroupStat[];
  insights: Insight[];
  closedCount: number;
}

export type PeriodKey = "today" | "90d" | "30d" | "month" | "all";
