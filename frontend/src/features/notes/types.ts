/** バックエンド types/note.ts・services/note/validationCalc.ts と対応 */
export type NoteKind = "ai" | "self";
export type ImprovementStatus = "needs_check" | "ruled";
export const AI_NAMES = ["Claude", "ChatGPT", "Gemini", "その他"] as const;
export type AiName = (typeof AI_NAMES)[number];

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  body: string;
  aiName: string | null;
  dataRangeLabel: string | null;
  rawResponse: string | null;
  emotionTags: string[];
  nextRule: string | null;
  sourceTradeId: string | null;
  createdAt: string;
}

export interface NoteListItem extends Note {
  improvementCount: number;
  ruledCount: number;
}

export interface Improvement {
  id: string;
  noteId: string;
  position: number;
  text: string;
  sampleN: number | null;
  status: ImprovementStatus;
  ruleId: string | null;
  validation: { count: number; target: number } | null;
}

export interface NoteDetail extends Note {
  improvements: Improvement[];
  sections: { heading: string; lines: string[] }[];
}

export interface Avg {
  n: number;
  avgR: number | null;
}

export interface RuleValidation {
  ruleId: string;
  title: string;
  startedAt: string;
  count: number;
  target: number;
  reached: boolean;
  before: Avg;
  after: Avg;
  kept: Avg;
  broken: Avg;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type NoteFilter = "all" | "ai" | "self" | "validating";
