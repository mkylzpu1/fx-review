import { sql } from "../lib/db";
import type {
  Improvement,
  NoteKind,
  NoteListItem,
  NoteRecord,
} from "../types/note";
import type { Rule } from "../types/trade";

const NOTE_COLUMNS = sql`
  n.id, n.kind, n.title, n.body, n.ai_name as "aiName", n.data_range_label as "dataRangeLabel",
  n.raw_response as "rawResponse", n.emotion_tags as "emotionTags", n.next_rule as "nextRule",
  n.source_trade_id as "sourceTradeId", to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
`;

const IMPROVEMENT_COLUMNS = sql`
  i.id, i.note_id as "noteId", i.position, i.text, i.sample_n as "sampleN",
  i.status, i.rule_id as "ruleId"
`;

export interface NoteWrite {
  kind: NoteKind;
  title: string;
  body: string;
  aiName: string | null;
  dataRangeLabel: string | null;
  rawResponse: string | null;
  emotionTags: string[];
  nextRule: string | null;
  sourceTradeId: string | null;
}

export interface NotePatch {
  title?: string;
  body?: string;
  emotionTags?: string[];
  /** undefined = 変更しない / null = 消す */
  nextRule?: string | null;
}

export interface ImprovementWrite {
  text: string;
  sampleN: number | null;
}

export interface NoteListFilter {
  kind?: NoteKind;
  /** ルール化した改善案を含むメモだけ（検証中の絞り込み） */
  validatingOnly?: boolean;
  limit: number;
  offset: number;
}

type ImprovementRow = Omit<Improvement, "validation">;

export const noteStore = {
  async list(
    userId: string,
    f: NoteListFilter,
  ): Promise<{ rows: NoteListItem[]; total: number }> {
    const where = sql`
      n.user_id = ${userId}
      ${f.kind ? sql`AND n.kind = ${f.kind}` : sql``}
      ${
        f.validatingOnly
          ? sql`AND EXISTS (SELECT 1 FROM note_improvements x WHERE x.note_id = n.id AND x.status = 'ruled')`
          : sql``
      }
    `;
    const rows = await sql<NoteListItem[]>`
      SELECT ${NOTE_COLUMNS},
        (SELECT COUNT(*)::int FROM note_improvements x WHERE x.note_id = n.id) as "improvementCount",
        (SELECT COUNT(*)::int FROM note_improvements x WHERE x.note_id = n.id AND x.status = 'ruled') as "ruledCount"
      FROM learning_notes n
      WHERE ${where}
      ORDER BY n.created_at DESC, n.id
      LIMIT ${f.limit} OFFSET ${f.offset}
    `;
    const count = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int as n FROM learning_notes n WHERE ${where}
    `;
    return { rows, total: count[0].n };
  },

  async findById(userId: string, id: string): Promise<NoteRecord | null> {
    const rows = await sql<NoteRecord[]>`
      SELECT ${NOTE_COLUMNS} FROM learning_notes n
      WHERE n.user_id = ${userId} AND n.id = ${id}
    `;
    return rows[0] ?? null;
  },

  async improvements(
    userId: string,
    noteId: string,
  ): Promise<ImprovementRow[]> {
    return sql<ImprovementRow[]>`
      SELECT ${IMPROVEMENT_COLUMNS} FROM note_improvements i
      WHERE i.user_id = ${userId} AND i.note_id = ${noteId}
      ORDER BY i.position
    `;
  },

  async findImprovement(
    userId: string,
    noteId: string,
    id: string,
  ): Promise<ImprovementRow | null> {
    const rows = await sql<ImprovementRow[]>`
      SELECT ${IMPROVEMENT_COLUMNS} FROM note_improvements i
      WHERE i.user_id = ${userId} AND i.note_id = ${noteId} AND i.id = ${id}
    `;
    return rows[0] ?? null;
  },

  /** メモと改善案を1つのトランザクションで作る */
  async create(
    userId: string,
    w: NoteWrite,
    improvements: ImprovementWrite[],
  ): Promise<string> {
    return sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        INSERT INTO learning_notes
          (user_id, kind, title, body, ai_name, data_range_label, raw_response, emotion_tags, next_rule, source_trade_id)
        VALUES (${userId}, ${w.kind}, ${w.title}, ${w.body}, ${w.aiName}, ${w.dataRangeLabel},
                ${w.rawResponse}, ${w.emotionTags}, ${w.nextRule}, ${w.sourceTradeId})
        RETURNING id
      `;
      const id = rows[0].id;
      for (const [position, imp] of improvements.entries()) {
        await tx`
          INSERT INTO note_improvements (user_id, note_id, position, text, sample_n)
          VALUES (${userId}, ${id}, ${position}, ${imp.text}, ${imp.sampleN})
        `;
      }
      return id;
    });
  },

  async update(userId: string, id: string, p: NotePatch): Promise<boolean> {
    const nextRuleGiven = p.nextRule !== undefined;
    const rows = await sql`
      UPDATE learning_notes SET
        title        = COALESCE(${p.title ?? null}, title),
        body         = COALESCE(${p.body ?? null}, body),
        emotion_tags = COALESCE(${p.emotionTags ?? null}, emotion_tags),
        next_rule    = CASE WHEN ${nextRuleGiven} THEN ${p.nextRule ?? null} ELSE next_rule END,
        updated_at   = NOW()
      WHERE user_id = ${userId} AND id = ${id}
      RETURNING id
    `;
    return rows.length > 0;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM learning_notes WHERE user_id = ${userId} AND id = ${id} RETURNING id
    `;
    return rows.length > 0;
  },

  /**
   * 改善案をルールにする。ルール作成（検証開始を記録）と改善案の更新を1つのトランザクションで行い、
   * 二重クリックでルールが2つできないよう、まだ未ルール化の行だけを更新する。
   * 既にルール化済みなら null を返す。
   */
  async convertToRule(
    userId: string,
    improvementId: string,
    rule: { title: string; description: string; sortOrder: number },
  ): Promise<Rule | null> {
    return sql.begin(async (tx) => {
      const claimed = await tx<{ id: string }[]>`
        UPDATE note_improvements SET status = 'ruled', updated_at = NOW()
        WHERE user_id = ${userId} AND id = ${improvementId} AND status = 'needs_check'
        RETURNING id
      `;
      if (claimed.length === 0) return null;
      const rows = await tx<Rule[]>`
        INSERT INTO rules (user_id, title, description, auto_key, is_active, sort_order, validation_started_at)
        VALUES (${userId}, ${rule.title}, ${rule.description}, NULL, TRUE, ${rule.sortOrder}, NOW())
        RETURNING id, title, description, is_active as "isActive", sort_order as "sortOrder",
          auto_key as "autoKey", validation_target_n as "validationTargetN",
          to_char(validation_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "validationStartedAt"
      `;
      await tx`
        UPDATE note_improvements SET rule_id = ${rows[0].id} WHERE id = ${improvementId}
      `;
      return rows[0];
    });
  },
};
