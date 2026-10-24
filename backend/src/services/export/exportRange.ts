export type ExportRange = "all" | "30d" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

/** そのタイムゾーンの、date 時点のUTCからのずれ（ミリ秒） */
function offsetMs(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    v("year"),
    v("month") - 1,
    v("day"),
    v("hour"),
    v("minute"),
    v("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** 対象期間の開始（ISO）。「すべて」は undefined。今月は表示タイムゾーンの月初 */
export function rangeFrom(
  range: ExportRange,
  timezone: string,
  now: Date,
): string | undefined {
  if (range === "all") return undefined;
  if (range === "30d")
    return new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const local = new Date(now.getTime() + offsetMs(timezone, now));
  const firstLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return new Date(
    firstLocal - offsetMs(timezone, new Date(firstLocal)),
  ).toISOString();
}

export const RANGE_LABEL: Record<ExportRange, string> = {
  all: "すべて",
  "30d": "直近30日",
  month: "今月",
};
