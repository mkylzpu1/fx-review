import { sql } from "../lib/db";
import { CANDLE_SOURCE } from "../constants/candles";
import type { Candle } from "../services/candles/CandleProvider";

export interface CandleRange {
  candles: Candle[];
  /** 範囲内に取得元が mock の足が含まれるか */
  hasMock: boolean;
}

interface Row {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  source: string;
}

const toRow = (pair: string, source: string, c: Candle) => ({
  pair,
  open_time: new Date(c.time * 1000),
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  source,
});

/** 同じ足があるときの書き換え条件。実データはモックを置き換えるが、モックは実データを壊さない */
const MOCK = CANDLE_SOURCE.mock;

export const candleStore = {
  /** [fromSec, toSec) の1分足を時刻の昇順で返す。limit+1 件まで読み、超えたら呼び出し側が検知する */
  async range(
    pair: string,
    fromSec: number,
    toSec: number,
    limit: number,
  ): Promise<CandleRange & { overLimit: boolean }> {
    const rows = await sql<Row[]>`
      SELECT EXTRACT(EPOCH FROM open_time)::float8 AS time,
             open::float8 AS open, high::float8 AS high,
             low::float8 AS low, close::float8 AS close, source
      FROM candles_1m
      WHERE pair = ${pair}
        AND open_time >= to_timestamp(${fromSec})
        AND open_time <  to_timestamp(${toSec})
      ORDER BY open_time
      LIMIT ${limit + 1}
    `;
    const overLimit = rows.length > limit;
    const used = overLimit ? rows.slice(0, limit) : rows;
    return {
      overLimit,
      hasMock: used.some((r) => r.source === MOCK),
      candles: used.map(({ time, open, high, low, close }) => ({
        time,
        open,
        high,
        low,
        close,
      })),
    };
  },

  /**
   * 1分足を保存する。
   * recent = true（直近48時間分）: 同じ取得元の足は上書きする（後から値が更新されることがあるため）
   * recent = false（それより古い分）: 既存の実データは変更しない
   * どちらも、モックの足は実データで置き換える。実データがある足をモックで壊さない。
   */
  async upsertMany(
    pair: string,
    source: string,
    candles: Candle[],
    recent: boolean,
  ): Promise<void> {
    if (candles.length === 0) return;
    const rows = candles.map((c) => toRow(pair, source, c));
    const cols = [
      "pair",
      "open_time",
      "open",
      "high",
      "low",
      "close",
      "source",
    ] as const;
    if (recent) {
      await sql`
        INSERT INTO candles_1m ${sql(rows, ...cols)}
        ON CONFLICT (pair, open_time) DO UPDATE SET
          open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
          close = EXCLUDED.close, source = EXCLUDED.source, updated_at = NOW()
        WHERE candles_1m.source = EXCLUDED.source
           OR (candles_1m.source = ${MOCK} AND EXCLUDED.source <> ${MOCK})
      `;
    } else {
      await sql`
        INSERT INTO candles_1m ${sql(rows, ...cols)}
        ON CONFLICT (pair, open_time) DO UPDATE SET
          open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
          close = EXCLUDED.close, source = EXCLUDED.source, updated_at = NOW()
        WHERE candles_1m.source = ${MOCK} AND EXCLUDED.source <> ${MOCK}
      `;
    }
  },
};
