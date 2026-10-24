export type NoteKind = "ai" | "self";
export type ImprovementStatus = "needs_check" | "ruled";

export interface NoteRecord {
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

/** ルール化した改善案の検証の進み具合 */
export interface ImprovementValidation {
  /** ルール化後（検証開始以降）のトレード数 */
  count: number;
  target: number;
}

export interface Improvement {
  id: string;
  noteId: string;
  position: number;
  text: string;
  sampleN: number | null;
  status: ImprovementStatus;
  ruleId: string | null;
  validation: ImprovementValidation | null;
}

export interface NoteListItem extends NoteRecord {
  improvementCount: number;
  ruledCount: number;
}

export interface ParsedSection {
  heading: string;
  lines: string[];
}

export interface NoteDetail extends NoteRecord {
  improvements: Improvement[];
  /** AIの回答を見出しごとに分けたもの（パースできない回答は空。原文表示にフォールバックする） */
  sections: ParsedSection[];
}
