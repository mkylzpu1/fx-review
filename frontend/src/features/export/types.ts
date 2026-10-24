export type ExportRange = "all" | "30d" | "month";
export type ExportFormat = "markdown" | "csv" | "json";
export type IncludeKey =
  "result" | "planDiff" | "rationale" | "ruleChecks" | "reflection" | "market";
export type Include = Record<IncludeKey, boolean>;

export interface ExportResult {
  content: string;
  filename: string;
  mime: string;
  tradeCount: number;
}
