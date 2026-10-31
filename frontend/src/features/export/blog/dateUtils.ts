/** 設定のタイムゾーンでの暦日・時刻を扱う（UTCの日付ではなく、利用者の1日で区切るため） */

const partsOf = (ms: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

/** ISO日時 → そのタイムゾーンでの YYYY-MM-DD */
export function localDate(iso: string, timeZone: string): string {
  return partsOf(Date.parse(iso), timeZone).date;
}

/** ISO日時 → そのタイムゾーンでの YYYY-MM-DD HH:mm */
export function localDateTime(iso: string, timeZone: string): string {
  const p = partsOf(Date.parse(iso), timeZone);
  return `${p.date} ${p.time}`;
}

/** 今日の暦日（そのタイムゾーン） */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return partsOf(now.getTime(), timeZone).date;
}

const DAY_MS = 86_400_000;
const toUtcMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 暦日に日数を足す（暦の計算だけなので、タイムゾーンは関係しない） */
export function addDays(date: string, n: number): string {
  return fromUtcMs(toUtcMs(date) + n * DAY_MS);
}

/** from〜to を両端含めた日数 */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1;
}

/** 範囲内の暦日を昇順で列挙 */
export function eachDay(from: string, to: string): string[] {
  const n = daysInclusive(from, to);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(from, i));
}

export const MAX_RANGE_DAYS = 31;

const isDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** 期間の検証。問題なければ null、あればエラーメッセージ */
export function validateRange(from: string, to: string): string | null {
  if (!isDate(from) || !isDate(to)) return "開始日と終了日を入力してください。";
  if (from > to) return "開始日が終了日より後になっています。";
  if (daysInclusive(from, to) > MAX_RANGE_DAYS)
    return `期間は最大${MAX_RANGE_DAYS}日までです。`;
  return null;
}

/** その日を含む週の月曜（暦の計算だけ。週は月曜始まり） */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 日=0 … 土=6
  return addDays(date, -((dow + 6) % 7));
}

/** 月曜〜日曜のちょうど1週間か（ブログは1記事=1週間分） */
export function isWeekRange(from: string, to: string): boolean {
  return mondayOf(from) === from && addDays(from, 6) === to;
}

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "thisWeek"
  | "lastWeek";

/** プリセット → 期間（そのタイムゾーンの暦日） */
export function presetRange(
  preset: RangePreset,
  timeZone: string,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = todayIn(timeZone, now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "thisWeek": {
      const mon = mondayOf(today);
      return { from: mon, to: addDays(mon, 6) };
    }
    case "lastWeek": {
      const mon = addDays(mondayOf(today), -7);
      return { from: mon, to: addDays(mon, 6) };
    }
  }
}

/**
 * 期間を覆うUTC日時（取得用）。タイムゾーンの差で端がこぼれないよう、前後に1日ずつ余裕を持たせる。
 * 実際の絞り込みは、取得後にタイムゾーンの暦日で行う
 */
export function fetchBounds(
  from: string,
  to: string,
): { from: string; to: string } {
  return {
    from: `${addDays(from, -1)}T00:00:00.000Z`,
    to: `${addDays(to, 2)}T00:00:00.000Z`,
  };
}
