import { nyOffsetSeconds } from "./resample";

const DAY = 86400;
const HOUR = 3600;
/** 金曜 17:00（ニューヨーク）に閉まり、日曜 17:00 に開く */
const CLOSE_DOW = 5;
const OPEN_DOW = 0;
const ROLLOVER = 17 * HOUR;

/** FXの取引時間内か（金曜17:00〜日曜17:00 ニューヨーク時間は休場。祝日は考慮しない） */
export function isMarketOpen(utcSec: number): boolean {
  const local = utcSec + nyOffsetSeconds(utcSec);
  const days = Math.floor(local / DAY);
  const secOfDay = local - days * DAY;
  // 1970-01-01 は木曜（4）
  const dow = (((days + 4) % 7) + 7) % 7;
  if (dow === 6) return false;
  if (dow === CLOSE_DOW && secOfDay >= ROLLOVER) return false;
  if (dow === OPEN_DOW && secOfDay < ROLLOVER) return false;
  return true;
}
