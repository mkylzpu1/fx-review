import { calcEma, type EmaPoint } from "./ema";
import type { Candle } from "../types";

export interface EmaLine {
  period: number;
  points: EmaPoint[];
}

export interface ChartData {
  candles: Candle[];
  emaLines: EmaLine[];
  /** エントリー時刻を含む足の開始時刻（UTC秒）。範囲内に無ければ null */
  entryTime: number | null;
}

/** ts（UTC秒）を含む足の開始時刻。最初の足より前なら null */
export function candleStartFor(
  candles: ReadonlyArray<{ time: number }>,
  tsSec: number,
): number | null {
  let found: number | null = null;
  for (const c of candles) {
    if (c.time <= tsSec) found = c.time;
    else break;
  }
  return found;
}

export interface BuildInput {
  /** API の candles（ウォームアップ込み・昇順） */
  candles: Candle[];
  warmupCount: number;
  emaPeriods: number[];
  entrySec: number;
  /** false のとき、エントリーの足より後を隠す */
  showAfter: boolean;
}

/**
 * 表示するローソク足とEMAを作る。
 * EMAはウォームアップ込みの全件で計算し、表示範囲の分だけ返す。
 */
export function buildChartData(i: BuildInput): ChartData {
  const entryTime = candleStartFor(i.candles.slice(i.warmupCount), i.entrySec);
  const visible = i.candles
    .slice(i.warmupCount)
    .filter((c) => i.showAfter || entryTime === null || c.time <= entryTime);
  if (visible.length === 0) return { candles: [], emaLines: [], entryTime };

  const first = visible[0].time;
  const last = visible[visible.length - 1].time;
  const emaLines = i.emaPeriods.map((period) => ({
    period,
    points: calcEma(i.candles, period).filter(
      (p) => p.time >= first && p.time <= last,
    ),
  }));
  return { candles: visible, emaLines, entryTime };
}
