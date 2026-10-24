import { getHistoricalRates } from "dukascopy-node";
import {
  CANDLE_PRICE_TYPE,
  CANDLE_SOURCE,
  DUKASCOPY_INSTRUMENT,
  DUKASCOPY_UTC_OFFSET,
} from "../../constants/candles";
import type { Candle, CandleProvider } from "./CandleProvider";

/** dukascopy-node が json 形式で返す1本分（使う項目だけ） */
export interface DukascopyRow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type FetchRates = (config: {
  instrument: typeof DUKASCOPY_INSTRUMENT;
  dates: { from: Date; to: Date };
  timeframe: "m1";
  format: "json";
  priceType: typeof CANDLE_PRICE_TYPE;
  utcOffset: number;
  volumes: false;
  ignoreFlats: true;
  useCache: false;
  retryCount: number;
}) => Promise<DukascopyRow[]>;

const defaultFetch: FetchRates = async (config) =>
  (await getHistoricalRates(config)) as DukascopyRow[];

/**
 * Dukascopy の1分足（bid）。時刻は UTC（utcOffset=0）で、timestamp はミリ秒。
 * 取引のない分は取得元が返さない（ignoreFlats）。
 */
export class DukascopyProvider implements CandleProvider {
  readonly source = CANDLE_SOURCE.dukascopy;

  constructor(private readonly fetchRates: FetchRates = defaultFetch) {}

  async fetch1m(_pair: "USDJPY", from: Date, to: Date): Promise<Candle[]> {
    const rows = await this.fetchRates({
      instrument: DUKASCOPY_INSTRUMENT,
      dates: { from, to },
      timeframe: "m1",
      format: "json",
      priceType: CANDLE_PRICE_TYPE,
      utcOffset: DUKASCOPY_UTC_OFFSET,
      volumes: false,
      ignoreFlats: true,
      useCache: false,
      retryCount: 3,
    });
    return toCandles(rows, from, to);
  }
}

/** 取得結果を [from, to) の範囲・時刻の昇順・重複なしの Candle にそろえる */
export function toCandles(
  rows: DukascopyRow[],
  from: Date,
  to: Date,
): Candle[] {
  const lo = Math.floor(from.getTime() / 1000);
  const hi = Math.floor(to.getTime() / 1000);
  const byTime = new Map<number, Candle>();
  for (const r of rows) {
    const time = Math.floor(r.timestamp / 1000);
    if (time < lo || time >= hi) continue;
    const values = [r.open, r.high, r.low, r.close];
    if (!values.every(Number.isFinite)) continue;
    byTime.set(time, {
      time,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
