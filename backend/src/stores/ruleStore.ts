import { sql } from "../lib/db";
import type { AutoKey, Rule } from "../types/trade";

const COLUMNS = sql`
  id, title, description, is_active as "isActive", sort_order as "sortOrder",
  auto_key as "autoKey", validation_target_n as "validationTargetN",
  to_char(validation_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "validationStartedAt"
`;

export interface RuleCreate {
  title: string;
  description: string;
  autoKey: AutoKey | null;
  isActive: boolean;
}

export interface RulePatch {
  title?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  /** undefined = 変更しない / null = 手動チェックに戻す */
  autoKey?: AutoKey | null;
}

export const ruleStore = {
  async list(userId: string): Promise<Rule[]> {
    return sql<Rule[]>`
      SELECT ${COLUMNS} FROM rules WHERE user_id = ${userId}
      ORDER BY sort_order, created_at
    `;
  },

  async findById(userId: string, id: string): Promise<Rule | null> {
    const rows = await sql<Rule[]>`
      SELECT ${COLUMNS} FROM rules WHERE user_id = ${userId} AND id = ${id}
    `;
    return rows[0] ?? null;
  },

  async maxSortOrder(userId: string): Promise<number> {
    const rows = await sql<{ max: number | null }[]>`
      SELECT MAX(sort_order) as max FROM rules WHERE user_id = ${userId}
    `;
    return rows[0]?.max ?? -1;
  },

  async create(
    userId: string,
    input: RuleCreate,
    sortOrder: number,
  ): Promise<Rule> {
    const rows = await sql<Rule[]>`
      INSERT INTO rules (user_id, title, description, auto_key, is_active, sort_order)
      VALUES (${userId}, ${input.title}, ${input.description}, ${input.autoKey}, ${input.isActive}, ${sortOrder})
      RETURNING ${COLUMNS}
    `;
    return rows[0];
  },

  async update(userId: string, id: string, p: RulePatch): Promise<Rule | null> {
    const autoKeyGiven = p.autoKey !== undefined;
    const rows = await sql<Rule[]>`
      UPDATE rules SET
        title       = COALESCE(${p.title ?? null}, title),
        description = COALESCE(${p.description ?? null}, description),
        is_active   = COALESCE(${p.isActive ?? null}, is_active),
        sort_order  = COALESCE(${p.sortOrder ?? null}, sort_order),
        auto_key    = CASE WHEN ${autoKeyGiven} THEN ${p.autoKey ?? null} ELSE auto_key END,
        updated_at  = NOW()
      WHERE user_id = ${userId} AND id = ${id}
      RETURNING ${COLUMNS}
    `;
    return rows[0] ?? null;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM rules WHERE user_id = ${userId} AND id = ${id} RETURNING id
    `;
    return rows.length > 0;
  },

  /** 指定IDのうち、このユーザーのルールの数（所有者チェック用） */
  async countOwned(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int as n FROM rules WHERE user_id = ${userId} AND id IN ${sql(ids)}
    `;
    return rows[0].n;
  },
};
