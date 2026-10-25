import type { TransactionSql } from "postgres";
import { sql } from "../lib/db";
import type {
  ExitMethod,
  RuleResult,
  Side,
  TradeRecord,
  TradeStatus,
} from "../types/trade";

/** trades を `t` として別名を付けたクエリ用の列（snake_case → camelCase、数値は number、日時はISO文字列） */
export const TRADE_COLUMNS = sql`
  t.id, t.source, t.pair, t.side, t.lots::float8 as lots,
  to_char(t.entry_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "entryAt",
  t.entry_price::float8 as "entryPrice",
  t.sl_price::float8 as "slPrice", t.tp_price::float8 as "tpPrice",
  t.sl_reason as "slReason", t.tp_reason as "tpReason",
  t.rationale_memo as "rationaleMemo", t.confidence,
  to_char(t.exit_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "exitAt",
  t.exit_price::float8 as "exitPrice", t.exit_method as "exitMethod",
  t.pnl_jpy::float8 as "pnlJpy", t.insight, t.next_rule as "nextRule", t.status,
  t.mfe_pips::float8 as "mfePips", t.mae_pips::float8 as "maePips",
  t.after_max_pips::float8 as "afterMaxPips"
`;

export type TradeRow = Omit<TradeRecord, "tags" | "ruleChecks">;

/** 保存する値（導出値は含まない。pnlJpy・status・exitMethod はサービスが決める） */
export interface TradeWrite {
  pair: string;
  side: Side;
  lots: number;
  entryAt: string;
  entryPrice: number;
  slPrice: number | null;
  tpPrice: number | null;
  slReason: string | null;
  tpReason: string | null;
  rationaleMemo: string | null;
  confidence: number | null;
  exitAt: string | null;
  exitPrice: number | null;
  exitMethod: ExitMethod;
  pnlJpy: number | null;
  insight: string | null;
  nextRule: string | null;
  status: TradeStatus;
}

export interface TradeLinks {
  tagIds: string[];
  ruleChecks: { ruleId: string; result: RuleResult }[];
}

/** 行にタグ・ルール判定を付けて TradeRecord にする（一覧でも1回のクエリ2本で済ませる） */
export async function attachLinks(rows: TradeRow[]): Promise<TradeRecord[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // タグとルール判定は互いに独立なので、同時に取りに行く
  const [tags, checks] = await Promise.all([
    sql<
      {
        tradeId: string;
        id: string;
        name: string;
        kind: "rationale" | "emotion";
      }[]
    >`
      SELECT tt.trade_id as "tradeId", g.id, g.name, g.kind
      FROM trade_tags tt JOIN tags g ON g.id = tt.tag_id
      WHERE tt.trade_id IN ${sql(ids)}
      ORDER BY g.kind, g.sort_order, g.created_at
    `,
    sql<{ tradeId: string; ruleId: string; result: RuleResult }[]>`
      SELECT trade_id as "tradeId", rule_id as "ruleId", result
      FROM trade_rule_checks WHERE trade_id IN ${sql(ids)}
    `,
  ]);
  return rows.map((r) => ({
    ...r,
    tags: tags
      .filter((x) => x.tradeId === r.id)
      .map(({ id, name, kind }) => ({ id, name, kind })),
    ruleChecks: checks
      .filter((x) => x.tradeId === r.id)
      .map(({ ruleId, result }) => ({ ruleId, result })),
  }));
}

async function writeLinks(
  tx: TransactionSql,
  tradeId: string,
  links: TradeLinks,
): Promise<void> {
  await tx`DELETE FROM trade_tags WHERE trade_id = ${tradeId}`;
  await tx`DELETE FROM trade_rule_checks WHERE trade_id = ${tradeId}`;
  if (links.tagIds.length > 0) {
    const rows = links.tagIds.map((tag_id) => ({ trade_id: tradeId, tag_id }));
    await tx`INSERT INTO trade_tags ${tx(rows, "trade_id", "tag_id")}`;
  }
  if (links.ruleChecks.length > 0) {
    const rows = links.ruleChecks.map((c) => ({
      trade_id: tradeId,
      rule_id: c.ruleId,
      result: c.result,
    }));
    await tx`INSERT INTO trade_rule_checks ${tx(rows, "trade_id", "rule_id", "result")}`;
  }
}

export const tradeStore = {
  async findById(
    userId: string,
    id: string,
    includeDeleted = false,
  ): Promise<TradeRecord | null> {
    const rows = await sql<TradeRow[]>`
      SELECT ${TRADE_COLUMNS} FROM trades t
      WHERE t.user_id = ${userId} AND t.id = ${id}
        AND (${includeDeleted} OR t.deleted_at IS NULL)
    `;
    return (await attachLinks(rows))[0] ?? null;
  },

  /** 新規作成（トレード・タグ・ルール判定を1トランザクションで保存）。作成したIDを返す */
  async create(
    userId: string,
    w: TradeWrite,
    links: TradeLinks,
    source: { source: "manual" | "rakuten_csv"; sourceKey: string | null },
  ): Promise<string> {
    return sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        INSERT INTO trades (
          user_id, source, source_key, pair, side, lots, entry_at, entry_price,
          sl_price, tp_price, sl_reason, tp_reason, rationale_memo, confidence,
          exit_at, exit_price, exit_method, pnl_jpy, insight, next_rule, status
        ) VALUES (
          ${userId}, ${source.source}, ${source.sourceKey}, ${w.pair}, ${w.side}, ${w.lots},
          ${w.entryAt}, ${w.entryPrice}, ${w.slPrice}, ${w.tpPrice}, ${w.slReason}, ${w.tpReason},
          ${w.rationaleMemo}, ${w.confidence}, ${w.exitAt}, ${w.exitPrice}, ${w.exitMethod},
          ${w.pnlJpy}, ${w.insight}, ${w.nextRule}, ${w.status}
        ) RETURNING id
      `;
      await writeLinks(tx, rows[0].id, links);
      return rows[0].id;
    });
  },

  /** 全項目の置き換え（PUT）。見つからなければ false */
  async update(
    userId: string,
    id: string,
    w: TradeWrite,
    links: TradeLinks,
  ): Promise<boolean> {
    return sql.begin(async (tx) => {
      const rows = await tx`
        UPDATE trades SET
          pair = ${w.pair}, side = ${w.side}, lots = ${w.lots},
          entry_at = ${w.entryAt}, entry_price = ${w.entryPrice},
          sl_price = ${w.slPrice}, tp_price = ${w.tpPrice},
          sl_reason = ${w.slReason}, tp_reason = ${w.tpReason},
          rationale_memo = ${w.rationaleMemo}, confidence = ${w.confidence},
          exit_at = ${w.exitAt}, exit_price = ${w.exitPrice}, exit_method = ${w.exitMethod},
          pnl_jpy = ${w.pnlJpy}, insight = ${w.insight}, next_rule = ${w.nextRule},
          status = ${w.status}, updated_at = NOW()
        WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) return false;
      await writeLinks(tx, id, links);
      return true;
    });
  },

  /** 論理削除 */
  async softDelete(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      UPDATE trades SET deleted_at = NOW(), updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL RETURNING id
    `;
    return rows.length > 0;
  },

  /** 削除の取り消し */
  async restore(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      UPDATE trades SET deleted_at = NULL, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NOT NULL RETURNING id
    `;
    return rows.length > 0;
  },

  /** 指定IDのうち、このユーザーのタグの数（所有者チェック用。削除済みタグも過去分として許可） */
  async countOwnedTags(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int as n FROM tags WHERE user_id = ${userId} AND id IN ${sql(ids)}
    `;
    return rows[0].n;
  },
};
