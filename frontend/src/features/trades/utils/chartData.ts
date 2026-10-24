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
  /** 決済時刻を含む足の開始時刻（UTC秒）。「エントリー後の値動き」がOFF・範囲外・未決済なら null */
  exitTime: number | null;
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
  /** 決済時刻（UTC秒）。未決済は null / 省略 */
  exitSec?: number | null;
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
  if (visible.length === 0)
    return { candles: [], emaLines: [], entryTime, exitTime: null };

  const first = visible[0].time;
  const last = visible[visible.length - 1].time;
  const emaLines = i.emaPeriods.map((period) => ({
    period,
    points: calcEma(i.candles, period).filter(
      (p) => p.time >= first && p.time <= last,
    ),
  }));
  const exitTime =
    i.showAfter && i.exitSec != null && i.exitSec >= first
      ? candleStartFor(visible, i.exitSec)
      : null;
  return { candles: visible, emaLines, entryTime, exitTime };
}

export interface CandleChunk {
  candles: Candle[];
  warmupCount: number;
}

/**
 * 範囲の違う複数の取得結果を、1本の時系列にまとめる（同じ時刻の足は1本に）。
 * 表示の先頭は、各結果の「ウォームアップを除いた最初の足」のうち最も古いもの。
 * それより前の足は、EMAの助走として扱う。
 */
export function mergeChunks(chunks: CandleChunk[]): CandleChunk {
  const byTime = new Map<number, Candle>();
  let displayStart = Infinity;
  for (const ch of chunks) {
    for (const c of ch.candles) byTime.set(c.time, c);
    const first = ch.candles[ch.warmupCount];
    if (first) displayStart = Math.min(displayStart, first.time);
  }
  const candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  const warmupCount = candles.filter((c) => c.time < displayStart).length;
  return { candles, warmupCount };
}
