export type Side = "buy" | "sell";
export type ExitMethod = "open" | "tp" | "sl" | "manual" | "breakeven";
export type TradeStatus = "draft" | "open" | "closed";
export type RuleResult = "ok" | "ng" | "na";
export type AutoKey = "sl_set" | "risk_within_limit" | "hold_to_tp";

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

/** DBに保存されている値（導出値を含まない） */
export interface TradeRecord {
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
  tags: { id: string; name: string; kind: "rationale" | "emotion" }[];
  ruleChecks: { ruleId: string; result: RuleResult }[];
}

/** 作成・更新の入力（tagIds / ruleChecks を含む） */
export interface TradeInput {
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
  insight: string | null;
  nextRule: string | null;
  draft: boolean;
  tagIds: string[];
  ruleChecks: { ruleId: string; result: RuleResult }[];
}

/** 導出値つきのトレード（APIが返す形） */
export interface TradeView extends TradeRecord {
  pips: number | null;
  rMultiple: number | null;
  plannedRr: number | null;
  riskJpy: number | null;
  riskPct: number | null;
  holdMinutes: number | null;
  /** 有効なルールごとの判定（自動判定は計算結果） */
  ruleResults: { ruleId: string; title: string; result: RuleResult }[];
  deviation: boolean;
  /** 入力のないトレード（キューの対象） */
  isUnfilled: boolean;
  missing: ("sl" | "tp" | "rationale" | "open")[];
}
