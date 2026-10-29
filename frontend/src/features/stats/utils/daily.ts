import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { DailyPoint } from "../types";

export type DailyMetric = "pnl" | "pips" | "r";

export const DAILY_METRICS: { key: DailyMetric; label: string }[] = [
  { key: "pnl", label: "損益（円）" },
  { key: "pips", label: "pips" },
  { key: "r", label: "R" },
];

/** その日の値。R が計算できた取引が無い日は null（棒を描かない） */
export function dayValue(d: DailyPoint, m: DailyMetric): number | null {
  if (m === "pnl") return d.pnlJpy;
  if (m === "pips") return d.pips;
  return d.rCount > 0 ? d.r : null;
}

/** その日までの累積 */
export function cumulativeValue(d: DailyPoint, m: DailyMetric): number {
  if (m === "pnl") return d.cumulativePnlJpy;
  if (m === "pips") return d.cumulativePips;
  return d.cumulativeR;
}

export function formatMetric(v: number | null, m: DailyMetric): string {
  if (m === "pnl") return formatYenSigned(v);
  if (m === "pips") return formatPips(v);
  return formatR(v);
}

/** 軸ラベル用の短い表記（単位なし） */
export function formatAxis(v: number, m: DailyMetric): string {
  if (m === "pnl") return Math.round(v).toLocaleString("ja-JP");
  return m === "pips" ? v.toFixed(0) : v.toFixed(1);
}

/** 「10/21」 */
export function shortDate(date: string): string {
  const [, mo, d] = date.split("-");
  return `${Number(mo)}/${Number(d)}`;
}

/** 日別の要約: 取引のあった日数・プラスの日数 */
export function dayCounts(daily: DailyPoint[], m: DailyMetric) {
  let plus = 0;
  let minus = 0;
  for (const d of daily) {
    const v = dayValue(d, m);
    if (v === null) continue;
    if (v > 0) plus += 1;
    else if (v < 0) minus += 1;
  }
  return { days: daily.length, plus, minus };
}
