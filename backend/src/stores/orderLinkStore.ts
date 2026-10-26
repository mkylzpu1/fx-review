import { sql } from "../lib/db";
import type { CandidateTrade, LinkUpdate } from "../types/orderImport";

interface CandidateRow {
  id: string;
  side: "buy" | "sell";
  lots: number;
  entryAt: Date | string;
  entryPrice: number;
  exitPrice: number | null;
  slPrice: number | null;
  tpPrice: number | null;
  exitMethod: CandidateTrade["exitMethod"];
}

/** 注文履歴の紐づけ用のSQL（ロジックは services/import/orderLinking に置く） */
export const orderLinkStore = {
  /** CSVから取り込んだ未削除のトレードのうち、指定日時以降にエントリーしたもの */
  async findCandidates(
    userId: string,
    pair: string,
    fromIso: string,
  ): Promise<CandidateTrade[]> {
    const rows = await sql<CandidateRow[]>`
      SELECT id, side, lots::float8 as lots, entry_at as "entryAt",
        entry_price::float8 as "entryPrice", exit_price::float8 as "exitPrice",
        sl_price::float8 as "slPrice", tp_price::float8 as "tpPrice",
        exit_method as "exitMethod"
      FROM trades
      WHERE user_id = ${userId} AND pair = ${pair}
        AND source = 'rakuten_csv' AND deleted_at IS NULL
        AND status IN ('open', 'closed')
        AND entry_at >= ${fromIso}
    `;
    return rows.map((r) => ({
      ...r,
      entryAt: new Date(r.entryAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
    }));
  },

  /**
   * SL・TP・決済の仕方を反映する（1トランザクション）。
   * 入力済みのSL・TPは残し（COALESCE）、決済の仕方も初期値の manual のときだけ直す。
   */
  async applyUpdates(userId: string, updates: LinkUpdate[]): Promise<number> {
    if (updates.length === 0) return 0;
    return sql.begin(async (tx) => {
      let n = 0;
      for (const u of updates) {
        const res = await tx`
          UPDATE trades SET
            sl_price = COALESCE(sl_price, ${u.slPrice}::numeric),
            tp_price = COALESCE(tp_price, ${u.tpPrice}::numeric),
            exit_method = CASE
              WHEN ${u.exitMethod}::text IS NOT NULL AND exit_method = 'manual'
              THEN ${u.exitMethod}::text ELSE exit_method END,
            updated_at = NOW()
          WHERE user_id = ${userId} AND id = ${u.tradeId}
            AND deleted_at IS NULL
          RETURNING id
        `;
        n += res.length;
      }
      return n;
    });
  },
};
