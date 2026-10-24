import { sql } from "../lib/db";
import type { Timeframe } from "../constants/candles";
import type { Side } from "../types/trade";

/** MFE/MAE の計算に必要な、トレードと設定の値 */
export interface ExcursionTarget {
  id: string;
  pair: string;
  side: Side;
  /** UTC秒 */
  entryAt: number;
  entryPrice: number;
  /** 未決済は null */
  exitAt: number | null;
  exitPrice: number | null;
  pipSize: number;
  chartBarsAfter: number;
  chartDefaultTf: Timeframe;
}

const TARGET_COLUMNS = sql`
  t.id, t.pair, t.side,
  EXTRACT(EPOCH FROM t.entry_at)::float8 AS "entryAt",
  t.entry_price::float8 AS "entryPrice",
  EXTRACT(EPOCH FROM t.exit_at)::float8 AS "exitAt",
  t.exit_price::float8 AS "exitPrice",
  COALESCE(cp.pip_size, 0.01)::float8 AS "pipSize",
  COALESCE(s.chart_bars_after, 60) AS "chartBarsAfter",
  COALESCE(s.chart_default_tf, '1h') AS "chartDefaultTf"
`;

const TARGET_JOINS = sql`
  FROM trades t
  LEFT JOIN currency_pairs cp ON cp.user_id = t.user_id AND cp.symbol = t.pair
  LEFT JOIN account_settings s ON s.user_id = t.user_id
`;

export interface ExcursionValues {
  mfePips: number | null;
  maePips: number | null;
  afterMaxPips: number | null;
}

export const excursionStore = {
  async findTarget(
    userId: string,
    id: string,
  ): Promise<ExcursionTarget | null> {
    const rows = await sql<ExcursionTarget[]>`
      SELECT ${TARGET_COLUMNS} ${TARGET_JOINS}
      WHERE t.user_id = ${userId} AND t.id = ${id} AND t.deleted_at IS NULL
    `;
    return rows[0] ?? null;
  },

  /** 全ユーザーの決済済みトレードのうち、エントリーが [from, to) のもの（同期スクリプト用） */
  async listClosedEnteredBetween(
    from: Date,
    to: Date,
  ): Promise<ExcursionTarget[]> {
    return sql<ExcursionTarget[]>`
      SELECT ${TARGET_COLUMNS} ${TARGET_JOINS}
      WHERE t.status = 'closed' AND t.deleted_at IS NULL
        AND t.exit_at IS NOT NULL AND t.exit_price IS NOT NULL
        AND t.entry_at >= ${from} AND t.entry_at < ${to}
      ORDER BY t.entry_at
    `;
  },

  async set(id: string, v: ExcursionValues): Promise<void> {
    await sql`
      UPDATE trades SET
        mfe_pips = ${v.mfePips}, mae_pips = ${v.maePips},
        after_max_pips = ${v.afterMaxPips}
      WHERE id = ${id}
    `;
  },
};
