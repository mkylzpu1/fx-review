import type { PendingQuery, Row } from "postgres";
import { sql } from "../lib/db";
import type {
  QueueFilter,
  TradeFilter,
  TradeRecord,
  TradeSort,
} from "../types/trade";
import { TRADE_COLUMNS, attachLinks, type TradeRow } from "./tradeStore";

const HAS_RATIONALE = sql`EXISTS (
  SELECT 1 FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id
  WHERE tt.trade_id = t.id AND g.kind = 'rationale'
)`;

/**
 * 未入力キューの絞り込み条件（SQL）。
 * 'all' が「入力のないトレード」の定義で、services/trade/unfilled.ts と同じ内容を保つこと。
 */
function queueCondition(f: QueueFilter): PendingQuery<Row[]> {
  switch (f) {
    case "all":
      return sql`(t.exit_at IS NULL OR (t.sl_price IS NULL AND t.tp_price IS NULL AND NOT ${HAS_RATIONALE}))`;
    case "sl_tp":
      return sql`(t.sl_price IS NULL OR t.tp_price IS NULL)`;
    case "no_rationale":
      return sql`NOT ${HAS_RATIONALE}`;
    case "open":
      return sql`t.exit_at IS NULL`;
    case "loss":
      return sql`t.pnl_jpy < 0`;
  }
}

const ORDER: Record<TradeSort, PendingQuery<Row[]>> = {
  entry_desc: sql`t.entry_at DESC, t.id`,
  entry_asc: sql`t.entry_at ASC, t.id`,
  // 未決済（損益なし）は常に最後
  pnl_desc: sql`t.pnl_jpy DESC NULLS LAST, t.entry_at DESC, t.id`,
  pnl_asc: sql`t.pnl_jpy ASC NULLS LAST, t.entry_at DESC, t.id`,
};

/** LIKE のワイルドカードをエスケープする */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function whereClause(userId: string, f: TradeFilter): PendingQuery<Row[]> {
  const none = sql``;
  return sql`
    t.user_id = ${userId} AND t.deleted_at IS NULL
    ${f.pair ? sql`AND t.pair = ${f.pair}` : none}
    ${f.from ? sql`AND t.entry_at >= ${f.from}::timestamptz` : none}
    ${f.to ? sql`AND t.entry_at <= ${f.to}::timestamptz` : none}
    ${f.result === "win" ? sql`AND t.pnl_jpy > 0` : none}
    ${f.result === "loss" ? sql`AND t.pnl_jpy < 0` : none}
    ${
      f.q
        ? sql`AND (t.rationale_memo ILIKE ${likePattern(f.q)} OR t.insight ILIKE ${likePattern(f.q)}
              OR t.next_rule ILIKE ${likePattern(f.q)} OR t.sl_reason ILIKE ${likePattern(f.q)}
              OR t.tp_reason ILIKE ${likePattern(f.q)} OR t.pair ILIKE ${likePattern(f.q)})`
        : none
    }
    ${f.queue ? sql`AND ${queueCondition(f.queue)}` : none}
  `;
}

export const tradeListStore = {
  /** 絞り込み・並べ替え・ページング。paging を省くと全件（逸脱の絞り込みなど、導出値が必要なとき用） */
  async list(
    userId: string,
    f: TradeFilter,
    paging?: { limit: number; offset: number },
  ): Promise<{ rows: TradeRecord[]; total: number }> {
    const where = whereClause(userId, f);
    const rows = await sql<TradeRow[]>`
      SELECT ${TRADE_COLUMNS} FROM trades t
      WHERE ${where}
      ORDER BY ${ORDER[f.sort]}
      ${paging ? sql`LIMIT ${paging.limit} OFFSET ${paging.offset}` : sql``}
    `;
    const count = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int as n FROM trades t WHERE ${where}
    `;
    return { rows: await attachLinks(rows), total: count[0].n };
  },

  /** キューの件数: 入力のないトレード / 全件 */
  async queueCounts(
    userId: string,
  ): Promise<{ pendingCount: number; totalCount: number }> {
    const rows = await sql<{ pending: number; total: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE ${queueCondition("all")})::int as pending,
        COUNT(*)::int as total
      FROM trades t
      WHERE t.user_id = ${userId} AND t.deleted_at IS NULL
    `;
    return { pendingCount: rows[0].pending, totalCount: rows[0].total };
  },
};
