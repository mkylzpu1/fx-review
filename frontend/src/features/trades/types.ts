/** バックエンド types/trade.ts（GET /trades などのレスポンス）と対応 */
import type { Timeframe } from "@/features/settings/types";
export type Side = "buy" | "sell";
export type ExitMethod = "open" | "tp" | "sl" | "manual" | "breakeven";
export type TradeStatus = "draft" | "open" | "closed";
export type RuleResult = "ok" | "ng" | "na";
export type AutoKey = "sl_set" | "risk_within_limit" | "hold_to_tp";
export type TradeSort = "entry_desc" | "entry_asc" | "pnl_desc" | "pnl_asc";
export type QueueFilter = "all" | "sl_tp" | "no_rationale" | "open" | "loss";
export type MissingItem = "sl" | "tp" | "rationale" | "open";

export interface TradeTag {
  id: string;
  name: string;
  kind: "rationale" | "emotion";
}

export interface Trade {
  id: string;
  source: "manual" | "rakuten_csv";
  pair: string;
  side: Side;
  lots: number;
  entryAt: string;
  entryPrice: number;
  slPrice: number | null;
  tpPrice: number | null;
  slReason: string | null;
  tpReason: string | null;
  rationaleMemo: string | null;
  confidence: number | null;
  exitAt: string | null;
  exitPrice: number | null;
  exitMethod: ExitMethod;
  pnlJpy: number | null;
  insight: string | null;
  nextRule: string | null;
  status: TradeStatus;
  mfePips: number | null;
  maePips: number | null;
  afterMaxPips: number | null;
  tags: TradeTag[];
  ruleChecks: { ruleId: string; result: RuleResult }[];
  // 導出値（サーバーで計算）
  pips: number | null;
  rMultiple: number | null;
  plannedRr: number | null;
  riskJpy: number | null;
  riskPct: number | null;
  holdMinutes: number | null;
  ruleResults: {
    ruleId: string;
    title: string;
    result: RuleResult;
    isActive: boolean;
  }[];
  deviation: boolean;
  isUnfilled: boolean;
  missing: MissingItem[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface QueueResult extends Page<Trade> {
  pendingCount: number;
  totalCount: number;
  filledCount: number;
}

/** POST /trades, PUT /trades/{id} のボディ */
export interface TradePayload {
  pair: string;
  side: Side;
  lots: number;
  entryAt: string;
  entryPrice: number;
  slPrice: number | null;
  tpPrice: number | null;
  slReason: string | null;
  tpReason: string | null;
  rationaleMemo: string | null;
  confidence: number | null;
  exitAt: string | null;
  exitPrice: number | null;
  exitMethod: Exclude<ExitMethod, "open"> | null;
  insight: string | null;
  nextRule: string | null;
  draft: boolean;
  tagIds: string[];
  ruleChecks: { ruleId: string; result: RuleResult }[];
}

/** GET /candles（time は足の開始時刻・UTC秒） */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CandlesResponse {
  tf: Timeframe;
  candles: Candle[];
  warmupCount: number;
  hasData: boolean;
  mock: boolean;
}
