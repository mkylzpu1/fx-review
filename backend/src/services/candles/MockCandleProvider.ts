import { CANDLE_SOURCE } from "../../constants/candles";
import type { Candle, CandleProvider } from "./CandleProvider";
import { isMarketOpen } from "./marketHours";

const MINUTE = 60;
const BASE_PRICE = 150;

/** 時刻だけから決まる擬似乱数（0以上1未満）。同じ時刻なら必ず同じ値 */
function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** 時刻の関数としてなめらかに動く価格。足どうしがつながって見える */
function priceAt(utcSec: number): number {
  const t = utcSec / MINUTE;
  return (
    BASE_PRICE +
    1.8 * Math.sin(t / 1900) +
    0.7 * Math.sin(t / 310) +
    0.25 * Math.sin(t / 47) +
    0.05 * Math.sin(t / 7)
  );
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** 決定的な疑似データ。テストと、取得元が使えないときの開発用 */
export class MockCandleProvider implements CandleProvider {
  readonly source = CANDLE_SOURCE.mock;

  async fetch1m(_pair: "USDJPY", from: Date, to: Date): Promise<Candle[]> {
    const start = Math.ceil(from.getTime() / 1000 / MINUTE) * MINUTE;
    const end = Math.floor(to.getTime() / 1000);
    const out: Candle[] = [];
    for (let t = start; t < end; t += MINUTE) {
      if (!isMarketOpen(t)) continue;
      const open = priceAt(t);
      const close = priceAt(t + MINUTE);
      const top = Math.max(open, close) + hash01(t) * 0.03;
      const bottom = Math.min(open, close) - hash01(t + 1) * 0.03;
      out.push({
        time: t,
        open: round3(open),
        high: round3(top),
        low: round3(bottom),
        close: round3(close),
      });
    }
    return out;
  }
}
