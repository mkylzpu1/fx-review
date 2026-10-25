import type { PeriodKey } from "../types";

export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "90d", label: "過去90日" },
  { value: "30d", label: "過去30日" },
  { value: "month", label: "今月" },
  { value: "all", label: "すべて" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 期間 → API の from（ISO）。「すべて」は指定なし。今月はJSTの月初 */
export function periodFrom(
  key: PeriodKey,
  now: Date = new Date(),
): string | undefined {
  if (key === "all") return undefined;
  if (key === "today") return todayStartJst(now);
  if (key === "month") {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    const start =
      Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET_MS;
    return new Date(start).toISOString();
  }
  const days = key === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

/** 比べる相手（直前の同じ長さの期間）。「すべて」は比べられないので null */
export function previousPeriod(
  key: PeriodKey,
  now: Date = new Date(),
): { from: string; to: string } | null {
  if (key === "all") return null;
  const from = new Date(periodFrom(key, now) as string);
  if (key === "today")
    return {
      from: new Date(from.getTime() - DAY_MS).toISOString(),
      to: from.toISOString(),
    };
  if (key === "month") {
    const jst = new Date(from.getTime() + JST_OFFSET_MS);
    const prev =
      Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() - 1, 1) - JST_OFFSET_MS;
    return { from: new Date(prev).toISOString(), to: from.toISOString() };
  }
  const days = key === "90d" ? 90 : 30;
  return {
    from: new Date(from.getTime() - days * DAY_MS).toISOString(),
    to: from.toISOString(),
  };
}

/** 今日（JST）の0時 */
export function todayStartJst(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const start =
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) -
    JST_OFFSET_MS;
  return new Date(start).toISOString();
}
