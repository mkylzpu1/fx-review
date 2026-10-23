import { sql } from "../lib/db";
import type { CurrencyPair } from "../types/settings";

const COLUMNS = sql`
  id, symbol, pip_size::float8 as "pipSize",
  pip_value_jpy_per_lot::float8 as "pipValueJpyPerLot", show_in_picker as "showInPicker"
`;

export const currencyPairStore = {
  async list(userId: string): Promise<CurrencyPair[]> {
    return sql<CurrencyPair[]>`
      SELECT ${COLUMNS} FROM currency_pairs WHERE user_id = ${userId} ORDER BY created_at, symbol
    `;
  },

  /** 同じ symbol があれば null を返す */
  async create(
    userId: string,
    p: Omit<CurrencyPair, "id">,
  ): Promise<CurrencyPair | null> {
    const rows = await sql<CurrencyPair[]>`
      INSERT INTO currency_pairs (user_id, symbol, pip_size, pip_value_jpy_per_lot, show_in_picker)
      VALUES (${userId}, ${p.symbol}, ${p.pipSize}, ${p.pipValueJpyPerLot}, ${p.showInPicker})
      ON CONFLICT (user_id, symbol) DO NOTHING
      RETURNING ${COLUMNS}
    `;
    return rows[0] ?? null;
  },

  async update(
    userId: string,
    id: string,
    p: Partial<Omit<CurrencyPair, "id" | "symbol">>,
  ): Promise<CurrencyPair | null> {
    const rows = await sql<CurrencyPair[]>`
      UPDATE currency_pairs SET
        pip_size              = COALESCE(${p.pipSize ?? null}, pip_size),
        pip_value_jpy_per_lot = COALESCE(${p.pipValueJpyPerLot ?? null}, pip_value_jpy_per_lot),
        show_in_picker        = COALESCE(${p.showInPicker ?? null}, show_in_picker),
        updated_at            = NOW()
      WHERE user_id = ${userId} AND id = ${id}
      RETURNING ${COLUMNS}
    `;
    return rows[0] ?? null;
  },

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM currency_pairs WHERE user_id = ${userId} AND id = ${id} RETURNING id
    `;
    return rows.length > 0;
  },
};
