import type { PeriodKey } from "../types";

export const PERIODS: { value: PeriodKey; label: string }[] = [
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
  if (key === "month") {
    const jst = new Date(now.getTime() + JST_OFFSET_MS);
    const start =
      Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET_MS;
    return new Date(start).toISOString();
  }
  const days = key === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
