import {
  ROLLOVER_HOUR,
  ROLLOVER_TIME_ZONE,
  TF_SECONDS,
  type Timeframe,
} from "../../constants/candles";
import type { Candle } from "./CandleProvider";

const HOUR = 3600;
const DAY = 86400;

const nyFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ROLLOVER_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

const offsetCache = new Map<number, number>();

/** ニューヨークのUTCオフセット（秒。夏時間は -14400、冬時間は -18000）。1時間単位でキャッシュ */
export function nyOffsetSeconds(utcSec: number): number {
  const key = Math.floor(utcSec / HOUR);
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  const parts = Object.fromEntries(
    nyFormat
      .formatToParts(new Date(key * HOUR * 1000))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) / 1000;
  const offset = asUtc - key * HOUR;
  offsetCache.set(key, offset);
  return offset;
}

/** その時刻を含む「取引日」の開始（ニューヨーク17:00）のUTC秒 */
export function sessionStart(utcSec: number): number {
  const local = utcSec + nyOffsetSeconds(utcSec);
  const secOfDay = ((local % DAY) + DAY) % DAY;
  const rollover = ROLLOVER_HOUR * HOUR;
  const anchorLocal =
    secOfDay >= rollover
      ? local - (secOfDay - rollover)
      : local - secOfDay - (DAY - rollover);
  // 現地時刻→UTC。区切り時刻自体のオフセットで戻す（夏時間の切り替えをまたぐ場合に備える）
  const guess = anchorLocal - nyOffsetSeconds(utcSec);
  return anchorLocal - nyOffsetSeconds(guess);
}

/** 足を含む区間の開始時刻（UTC秒） */
export function bucketStart(utcSec: number, tf: Timeframe): number {
  if (tf === "1d") return sessionStart(utcSec);
  if (tf === "4h") {
    const start = sessionStart(utcSec);
    return (
      start + Math.floor((utcSec - start) / TF_SECONDS["4h"]) * TF_SECONDS["4h"]
    );
  }
  const size = TF_SECONDS[tf];
  return Math.floor(utcSec / size) * size;
}

/**
 * 1分足を上位足に集計する（純粋関数）。入力は時刻の昇順。
 * 取引のない分は補完しない（欠けた分はそのまま飛ばす）。
 * 5m/15m/1h はUTCの区切り、4h/1d はニューヨーク17:00区切り。
 */
export function resample(candles1m: Candle[], tf: Timeframe): Candle[] {
  if (tf === "1m") return candles1m.map((c) => ({ ...c }));
  const out: Candle[] = [];
  let current: Candle | null = null;
  for (const c of candles1m) {
    const start = bucketStart(c.time, tf);
    if (current && current.time === start) {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
    } else {
      current = {
        time: start,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
      out.push(current);
    }
  }
  return out;
}
