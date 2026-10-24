import {
  CANDLE_PAIR,
  RECENT_OVERWRITE_HOURS,
  SYNC_CHUNK_DAYS,
  SYNC_UPSERT_BATCH,
} from "../../constants/candles";
import { candleStore } from "../../stores/candleStore";
import type { Candle, CandleProvider } from "./CandleProvider";

const DAY_MS = 86_400_000;

export interface SyncProgress {
  from: Date;
  to: Date;
  fetched: number;
}

export interface SyncResult {
  fetched: number;
  chunks: number;
}

/** [from, to) を日数ごとに分けた区間 */
export function splitRange(
  from: Date,
  to: Date,
  chunkDays: number,
): { from: Date; to: Date }[] {
  const out: { from: Date; to: Date }[] = [];
  const step = chunkDays * DAY_MS;
  for (let t = from.getTime(); t < to.getTime(); t += step) {
    out.push({
      from: new Date(t),
      to: new Date(Math.min(t + step, to.getTime())),
    });
  }
  return out;
}

/** 直近48時間以内（上書きしてよい）と、それより古い足に分ける */
export function splitRecent(
  candles: Candle[],
  now: Date,
): { recent: Candle[]; old: Candle[] } {
  const border =
    Math.floor(now.getTime() / 1000) - RECENT_OVERWRITE_HOURS * 3600;
  return {
    recent: candles.filter((c) => c.time >= border),
    old: candles.filter((c) => c.time < border),
  };
}

function* batches<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

/** 取得元から1分足を取り、candles_1m に保存する。再実行しても安全 */
export async function syncCandles(
  provider: CandleProvider,
  from: Date,
  to: Date,
  options: {
    now?: Date;
    onProgress?: (p: SyncProgress) => void;
  } = {},
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const ranges = splitRange(from, to, SYNC_CHUNK_DAYS);
  let fetched = 0;
  for (const range of ranges) {
    const candles = await provider.fetch1m(CANDLE_PAIR, range.from, range.to);
    const { recent, old } = splitRecent(candles, now);
    for (const part of batches(old, SYNC_UPSERT_BATCH))
      await candleStore.upsertMany(CANDLE_PAIR, provider.source, part, false);
    for (const part of batches(recent, SYNC_UPSERT_BATCH))
      await candleStore.upsertMany(CANDLE_PAIR, provider.source, part, true);
    fetched += candles.length;
    options.onProgress?.({ ...range, fetched: candles.length });
  }
  return { fetched, chunks: ranges.length };
}
