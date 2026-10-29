/** 楽天FX証券の約定1行（パース済み） */
export interface ExecutionRow {
  no: string;
  pair: string;
  kind: "open" | "close";
  side: "buy" | "sell";
  /** 通貨単位（10000 = 0.1 lot） */
  quantity: number;
  rate: number;
  /** 決済行の取引損益（円換算）。新規行は null */
  pnlJpy: number | null;
  /** 約定日時（UTCのISO文字列） */
  executedAt: string;
  file: string;
  line: number;
}

/** 取り込み候補のトレード（新規1回＋決済1回、または未決済の新規） */
export interface ImportTrade {
  sourceKey: string;
  entryNo: string;
  exitNo: string | null;
  pair: string;
  side: "buy" | "sell";
  lots: number;
  entryAt: string;
  entryPrice: number;
  exitAt: string | null;
  exitPrice: number | null;
  pnlJpy: number | null;
  status: "open" | "closed";
}

export interface ImportRowError {
  file: string;
  /** CSV上の行番号（ヘッダーが1行目）。ペアの場合は決済行 */
  line: number;
  executionNo: string | null;
  message: string;
}

/** ファイル単位の判定（別形式のCSVはここで弾く） */
export interface ImportFileResult {
  name: string;
  status: "ok" | "error";
  rowCount: number;
  message: string | null;
}

/** 手入力済みのトレード（CSVの取引と同じものか照合するための最小の項目） */
export interface ManualTrade {
  id: string;
  pair: string;
  side: "buy" | "sell";
  lots: number;
  /** UTCのISO文字列 */
  entryAt: string;
  entryPrice: number;
  exitAt: string | null;
}
