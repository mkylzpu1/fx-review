/** バックエンド types/import.ts・services/import/importService.ts のレスポンスと対応 */
export type DuplicateMode = "skip" | "overwrite";
export type PreviewStatus = "new" | "duplicate" | "completes_open";

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
  errorCount: number;
  files: ImportFileResult[];
  entryRange: EntryRange | null;
}
