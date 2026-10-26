/** 楽天FX証券の注文履歴の1行（パース済み） */
export interface OrderRow {
  no: number;
  pattern: string;
  pair: string;
  kind: "open" | "close";
  side: "buy" | "sell";
  /** 通貨単位（10000 = 1 lot） */
  quantity: number;
  /** 注文日時（UTCのISO文字列） */
  orderedAt: string;
  /** 状態の元の文字列（約定済 / 取消済（失効）/ リジェクト など） */
  state: string;
  exec: "market" | "limit" | "stop" | "other";
  orderRate: number | null;
  fillRate: number | null;
  /** 決済注文が対象にしている建玉の約定レート */
  openRate: number | null;
  file: string;
  line: number;
}

export type ExitHint = "tp" | "sl" | "manual";

/** 約定済みの新規注文と、そこに付いていた決済注文（SL・TP）から読み取れる計画 */
export interface OrderPlan {
  entryOrderNo: number;
  pair: string;
  side: "buy" | "sell";
  lots: number;
  orderedAt: string;
  entryRate: number;
  slPrice: number | null;
  tpPrice: number | null;
  /** 約定した決済注文の種類。決済がまだ・読み取れないときは null */
  exitHint: ExitHint | null;
  exitRate: number | null;
}

/** 約定しなかった新規注文（取消・期限切れ・待機中・リジェクト） */
export interface UnfilledOrder {
  entryOrderNo: number;
  pair: string;
  side: "buy" | "sell";
  lots: number;
  orderedAt: string;
  state: string;
  orderRate: number | null;
  slPrice: number | null;
  tpPrice: number | null;
}

export interface OrderRowError {
  file: string;
  line: number;
  orderNo: string | null;
  message: string;
}

/** 照合に使う、取り込み済みトレードの必要な項目 */
export interface CandidateTrade {
  id: string;
  side: "buy" | "sell";
  lots: number;
  entryAt: string;
  entryPrice: number;
  exitPrice: number | null;
  slPrice: number | null;
  tpPrice: number | null;
  exitMethod: "open" | "tp" | "sl" | "manual" | "breakeven";
}

export interface LinkUpdate {
  tradeId: string;
  entryOrderNo: number;
  /** null のときは更新しない（すでに入力済み・または反映できない） */
  slPrice: number | null;
  tpPrice: number | null;
  exitMethod: "tp" | "sl" | null;
}

export interface LinkResult {
  updates: LinkUpdate[];
  /** 紐づけたトレード数（更新する項目が無かったものも含む） */
  matched: number;
  /** 取り込み済みトレードが見つからなかった約定済み注文 */
  unmatched: OrderPlan[];
  /** 逆指値が利益側にあり、SLとして反映しなかった件数 */
  slOnProfitSide: number;
}
