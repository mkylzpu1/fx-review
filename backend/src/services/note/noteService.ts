import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import {
  noteStore,
  type NotePatch,
  type NoteWrite,
} from "../../stores/noteStore";
import { ruleStore } from "../../stores/ruleStore";
import { tradeStore } from "../../stores/tradeStore";
import type {
  Improvement,
  NoteDetail,
  NoteKind,
  NoteListItem,
} from "../../types/note";
import type { Page, Rule } from "../../types/trade";
import { tradeService } from "../trade/tradeService";
import { parseAiResponse } from "./parseAiResponse";
import { validateRule, type RuleValidation } from "./validationCalc";

export interface NoteListQuery {
  kind?: NoteKind;
  validatingOnly?: boolean;
  page: number;
  limit: number;
}

export interface SelfNoteInput {
  title: string;
  body: string;
  emotionTags: string[];
  nextRule: string | null;
  sourceTradeId: string | null;
}

export interface AiNoteInput {
  aiName: string;
  dataRangeLabel: string | null;
  rawResponse: string;
  title: string | null;
}

const SUMMARY_CHARS = 200;
const RULE_TITLE_CHARS = 100;
const RULE_DESCRIPTION_CHARS = 500;

/** 一覧に出す要約: 見出しと箇条書きを除いた最初の文章。無ければ原文の先頭 */
export function summaryOf(
  raw: string,
  sections: { heading: string; lines: string[] }[],
): string {
  const bullet =
    /^\s*(?:[-*・•●○]|[0-9０-９]{1,2}\s*[.)）．、]|[（(][0-9０-９]{1,2}[)）]|[①-⑳])/;
  const prose = sections.flatMap((s) => s.lines).find((l) => !bullet.test(l));
  const text = prose ?? raw.trim();
  return text.replace(/\s+/g, " ").slice(0, SUMMARY_CHARS);
}

/** 「2026-10-24」（日本時間）。タイトルの既定に使う */
function jstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function assertOwnedTrade(
  userId: string,
  id: string | null,
): Promise<void> {
  if (id !== null && !(await tradeStore.findById(userId, id))) {
    throw new ValidationError("選択したトレードが見つかりません");
  }
}

/** ルール化済みの改善案に、検証の進み具合（ルール化後の件数 / 目標）を付ける */
async function withValidation(
  userId: string,
  rows: Omit<Improvement, "validation">[],
): Promise<Improvement[]> {
  const ruleIds = [
    ...new Set(rows.flatMap((r) => (r.ruleId ? [r.ruleId] : []))),
  ];
  if (ruleIds.length === 0)
    return rows.map((r) => ({ ...r, validation: null }));
  const map = new Map((await validations(userId)).map((v) => [v.ruleId, v]));
  return rows.map((r) => {
    const v = r.ruleId ? map.get(r.ruleId) : undefined;
    return {
      ...r,
      validation: v ? { count: v.count, target: v.target } : null,
    };
  });
}

/** 検証中（ルール化した改善案）の一覧。ルール前後の成績比較つき */
export async function validations(userId: string): Promise<RuleValidation[]> {
  const rules = (await ruleStore.list(userId)).filter(
    (r) => r.validationStartedAt !== null,
  );
  if (rules.length === 0) return [];
  const views = await tradeService.listAll(userId, {});
  return rules.flatMap((r) => {
    const v = validateRule(r, views);
    return v ? [v] : [];
  });
}

export const noteService = {
  async list(userId: string, q: NoteListQuery): Promise<Page<NoteListItem>> {
    const { rows, total } = await noteStore.list(userId, {
      kind: q.kind,
      validatingOnly: q.validatingOnly,
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    return { items: rows, total, page: q.page, limit: q.limit };
  },

  async get(userId: string, id: string): Promise<NoteDetail> {
    const note = await noteStore.findById(userId, id);
    if (!note) throw new NotFoundError("学習メモ");
    const improvements = await withValidation(
      userId,
      await noteStore.improvements(userId, id),
    );
    const sections =
      note.kind === "ai" && note.rawResponse
        ? parseAiResponse(note.rawResponse).sections
        : [];
    return { ...note, improvements, sections };
  },

  async createSelf(userId: string, input: SelfNoteInput): Promise<NoteDetail> {
    await assertOwnedTrade(userId, input.sourceTradeId);
    const write: NoteWrite = {
      kind: "self",
      title: input.title,
      body: input.body,
      aiName: null,
      dataRangeLabel: null,
      rawResponse: null,
      emotionTags: input.emotionTags,
      nextRule: input.nextRule,
      sourceTradeId: input.sourceTradeId,
    };
    return noteService.get(userId, await noteStore.create(userId, write, []));
  },

  /** AIの回答を貼り付けて保存する。改善案は簡易パースで取り出し、取り出せなければ原文だけを残す */
  async createAi(
    userId: string,
    input: AiNoteInput,
    now = new Date(),
  ): Promise<NoteDetail> {
    const parsed = parseAiResponse(input.rawResponse);
    const write: NoteWrite = {
      kind: "ai",
      title: input.title ?? `${input.aiName}の分析 ${jstDate(now)}`,
      body: summaryOf(input.rawResponse, parsed.sections),
      aiName: input.aiName,
      dataRangeLabel: input.dataRangeLabel,
      rawResponse: input.rawResponse,
      emotionTags: [],
      nextRule: null,
      sourceTradeId: null,
    };
    const id = await noteStore.create(userId, write, parsed.improvements);
    return noteService.get(userId, id);
  },

  async update(
    userId: string,
    id: string,
    patch: NotePatch,
  ): Promise<NoteDetail> {
    if (!(await noteStore.update(userId, id, patch)))
      throw new NotFoundError("学習メモ");
    return noteService.get(userId, id);
  },

  async delete(userId: string, id: string): Promise<void> {
    if (!(await noteStore.delete(userId, id)))
      throw new NotFoundError("学習メモ");
  },

  /** 改善案をルールにする（検証中として始まる）。二重に押されても、ルールは1つしか作らない */
  async toRule(
    userId: string,
    noteId: string,
    improvementId: string,
  ): Promise<Rule> {
    const imp = await noteStore.findImprovement(userId, noteId, improvementId);
    if (!imp) throw new NotFoundError("改善案");
    const sortOrder = (await ruleStore.maxSortOrder(userId)) + 1;
    const rule = await noteStore.convertToRule(userId, improvementId, {
      title: imp.text.slice(0, RULE_TITLE_CHARS),
      description: imp.text.slice(0, RULE_DESCRIPTION_CHARS),
      sortOrder,
    });
    if (!rule)
      throw new ConflictError("この改善案は、すでにルールにしています");
    return rule;
  },

  validations,
};
