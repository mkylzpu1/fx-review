export interface EmaPoint {
  time: number;
  value: number;
}

/**
 * 指数移動平均（EMA）。最初のEMAは直近 period 本の単純平均を起点にする。
 * period 本に満たない先頭の足には値を出さない（返すのは period 本目から）。
 */
export function calcEma(
  candles: ReadonlyArray<{ time: number; close: number }>,
  period: number,
): EmaPoint[] {
  if (!Number.isInteger(period) || period < 1 || candles.length < period) {
    return [];
  }
  const k = 2 / (period + 1);
  let prev =
    candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
  const out: EmaPoint[] = [{ time: candles[period - 1].time, value: prev }];
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}
