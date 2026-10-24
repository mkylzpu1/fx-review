import type { Timeframe } from "@/features/settings/types";

/** 時間足1本の秒数（表示範囲の計算用。足の区切りそのものはサーバーが決める） */
export const TF_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** バックエンドの warmup 上限（GET /candles） */
export const MAX_WARMUP = 2000;
/** EMAのウォームアップは最長期間のこの倍数だけ余分に取る */
export const WARMUP_FACTOR = 3;

export interface ChartRange {
  from: string;
  to: string;
  warmup: number;
}

export interface ChartRangeInput {
  entryAt: string;
  exitAt: string | null;
  tf: Timeframe;
  barsBefore: number;
  barsAfter: number;
  emaPeriods: number[];
}

/** 最長EMA期間の3倍（上限2000）。EMAが無いときは0 */
export function warmupBars(emaPeriods: number[]): number {
  const valid = emaPeriods.filter((p) => Number.isInteger(p) && p > 0);
  if (valid.length === 0) return 0;
  return Math.min(MAX_WARMUP, Math.max(...valid) * WARMUP_FACTOR);
}

/**
 * 詳細画面で要求する範囲。
 * エントリーの chartBarsBefore 本前から、決済（未決済ならエントリー）の chartBarsAfter 本後まで。
 */
export function chartRange(i: ChartRangeInput): ChartRange {
  const step = TF_SECONDS[i.tf] * 1000;
  const entry = Date.parse(i.entryAt);
  const end = i.exitAt ? Math.max(Date.parse(i.exitAt), entry) : entry;
  return {
    from: new Date(entry - i.barsBefore * step).toISOString(),
    to: new Date(end + i.barsAfter * step).toISOString(),
    warmup: warmupBars(i.emaPeriods),
  };
}

/** スクロールで足す範囲（ミリ秒で受ける）。ウォームアップは先頭側の追加でだけ使う */
export function extendRange(
  fromMs: number,
  toMs: number,
  warmup: number,
): ChartRange {
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    warmup,
  };
}
