import { sql } from "../lib/db";
import type { Tag, TagKind } from "../types/settings";

const COLUMNS = sql`id, kind, name, sort_order as "sortOrder"`;

export const tagStore = {
  async list(userId: string, kind?: TagKind): Promise<Tag[]> {
    return sql<Tag[]>`
      SELECT ${COLUMNS} FROM tags
      WHERE user_id = ${userId} AND deleted_at IS NULL
        AND (${kind ?? null}::text IS NULL OR kind = ${kind ?? null})
      ORDER BY kind, sort_order, created_at
    `;
  },

  /** 削除済みの同名タグがあれば復活させる */
  async upsert(
    userId: string,
    kind: TagKind,
    name: string,
    sortOrder: number,
  ): Promise<Tag> {
    const rows = await sql<Tag[]>`
      INSERT INTO tags (user_id, kind, name, sort_order)
      VALUES (${userId}, ${kind}, ${name}, ${sortOrder})
      ON CONFLICT (user_id, kind, name)
      DO UPDATE SET deleted_at = NULL, sort_order = EXCLUDED.sort_order, updated_at = NOW()
      RETURNING ${COLUMNS}
    `;
    return rows[0];
  },

  /** 有効なタグの中で、同名の有効タグがあるか */
  async existsActive(
    userId: string,
    kind: TagKind,
    name: string,
  ): Promise<boolean> {
    const rows = await sql`
      SELECT 1 FROM tags
      WHERE user_id = ${userId} AND kind = ${kind} AND name = ${name} AND deleted_at IS NULL
    `;
    return rows.length > 0;
  },

  async maxSortOrder(userId: string, kind: TagKind): Promise<number> {
    const rows = await sql<{ max: number | null }[]>`
      SELECT MAX(sort_order) as max FROM tags WHERE user_id = ${userId} AND kind = ${kind}
    `;
    return rows[0]?.max ?? -1;
  },

  async update(
    userId: string,
    id: string,
    p: { name?: string; sortOrder?: number },
  ): Promise<Tag | null> {
    const rows = await sql<Tag[]>`
      UPDATE tags SET
        name       = COALESCE(${p.name ?? null}, name),
        sort_order = COALESCE(${p.sortOrder ?? null}, sort_order),
        updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL
      RETURNING ${COLUMNS}
    `;
    return rows[0] ?? null;
  },

  /** 論理削除 */
  async softDelete(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      UPDATE tags SET deleted_at = NOW(), updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL RETURNING id
    `;
    return rows.length > 0;
  },
};
