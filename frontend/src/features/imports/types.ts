/** バックエンド types/import.ts・services/import/importService.ts のレスポンスと対応 */
export type DuplicateMode = "skip" | "overwrite";
export type PreviewStatus =
  "new" | "duplicate" | "completes_open" | "manual_duplicate";

export interface ImportFileInput {
  name: string;
  text: string;
}

export interface ImportFileResult {
  name: string;
  status: "ok" | "error";
  rowCount: number;
  message: string | null;
}

export interface ImportRowError {
  file: string;
  line: number;
  executionNo: string | null;
  message: string;
}

export interface PreviewTrade {
  sourceKey: string;
  importStatus: PreviewStatus;
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

export interface PreviewSummary {
  total: number;
  newCount: number;
  duplicateCount: number;
  /** 手入力済みのトレードと同じ取引のため、保存しない件数 */
  manualDuplicateCount: number;
  completesOpenCount: number;
  openCount: number;
  errorCount: number;
  overlappedRows: number;
}

export interface EntryRange {
  from: string;
  to: string;
}

export interface PreviewResult {
  files: ImportFileResult[];
  summary: PreviewSummary;
  trades: PreviewTrade[];
  errors: ImportRowError[];
  entryRange: EntryRange | null;
}

export interface CommitResult {
  imported: number;
  skipped: number;
  overwritten: number;
  completedOpen: number;
  /** 手入力済みのトレードと同じ取引のため、保存しなかった件数 */
  manualSkipped: number;
  errorCount: number;
  files: ImportFileResult[];
  entryRange: EntryRange | null;
}

/** 注文履歴CSV（SL・TPの紐づけ）。バックエンド services/import/orderLinkService.ts と対応 */
export interface OrderPlan {
  entryOrderNo: number;
  side: "buy" | "sell";
  lots: number;
  orderedAt: string;
  entryRate: number;
}

export interface UnfilledOrder {
  entryOrderNo: number;
  side: "buy" | "sell";
  lots: number;
  orderedAt: string;
  state: string;
  orderRate: number | null;
  slPrice: number | null;
  tpPrice: number | null;
}

export interface OrderLinkSummary {
  filledOrders: number;
  matched: number;
  willUpdate: number;
  unmatched: number;
  slOnProfitSide: number;
  unfilled: number;
  rejected: number;
  errorCount: number;
}

export interface OrderLinkPreview {
  kind: "orders";
  files: ImportFileResult[];
  summary: OrderLinkSummary;
  unmatched: OrderPlan[];
  unfilled: UnfilledOrder[];
  errors: ImportRowError[];
}

export interface OrderLinkCommit extends Omit<OrderLinkPreview, "unmatched"> {
  updated: number;
}

export const isOrderPreview = (
  p: PreviewResult | OrderLinkPreview,
): p is OrderLinkPreview => "kind" in p && p.kind === "orders";

export const isOrderCommit = (
  r: CommitResult | OrderLinkCommit,
): r is OrderLinkCommit => "kind" in r && r.kind === "orders";
