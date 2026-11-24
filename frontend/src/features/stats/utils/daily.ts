import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { DailyPoint } from "../types";

export type DailyMetric = "pnl" | "pips" | "r" | "winRate" | "count";

/** 損益のように符号で色分けする指標か（勝率・件数は常に非負なので別扱い） */
export const isSignedMetric = (m: DailyMetric): boolean =>
  m === "pnl" || m === "pips" || m === "r";

/** 日々の成長チャートの棒の間隔 */
export type Granularity = "day" | "week" | "month" | "year";

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

export const unitLabel = (g: Granularity): string =>
  g === "day" ? "日" : g === "week" ? "週" : g === "month" ? "月" : "年";

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** 月曜始まりの週の開始日（YYYY-MM-DD）。dateは暦日の文字列なのでUTCとして扱って問題ない */
function mondayStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

/** 指定した間隔での、そのグループを代表する日付（週は月曜、月は1日、年は1/1） */
export function bucketKey(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "week") return mondayStart(date);
  if (g === "month") return `${date.slice(0, 7)}-01`;
  return `${date.slice(0, 4)}-01-01`;
}

/**
 * 日次データを週・月・年単位にまとめる。件数・勝数・pips・損益・Rは合計、
 * 累積はそのグループ内で最も新しい日の値（dailyは古い順なので上書きしていけば残る）
 */
export function aggregateDaily(
  daily: DailyPoint[],
  g: Granularity,
): DailyPoint[] {
  if (g === "day") return daily;
  const out: DailyPoint[] = [];
  for (const d of daily) {
    const key = bucketKey(d.date, g);
    const prev = out[out.length - 1];
    const bucket =
      prev && prev.date === key
        ? prev
        : ({
            date: key,
            n: 0,
            wins: 0,
            pips: 0,
            pnlJpy: 0,
            r: 0,
            rCount: 0,
            cumulativePips: 0,
            cumulativePnlJpy: 0,
            cumulativeR: 0,
          } satisfies DailyPoint);
    bucket.n += d.n;
    bucket.wins += d.wins;
    bucket.pips = round(bucket.pips + d.pips, 1);
    bucket.pnlJpy = round(bucket.pnlJpy + d.pnlJpy, 0);
    bucket.r = round(bucket.r + d.r, 2);
    bucket.rCount += d.rCount;
    bucket.cumulativePips = d.cumulativePips;
    bucket.cumulativePnlJpy = d.cumulativePnlJpy;
    bucket.cumulativeR = d.cumulativeR;
    if (!prev || prev.date !== key) out.push(bucket);
  }
  return out;
}

export const DAILY_METRICS: { key: DailyMetric; label: string }[] = [
  { key: "pnl", label: "損益（円）" },
  { key: "pips", label: "pips" },
];

/** その日の値。R が計算できた取引が無い日は null（棒を描かない） */
export function dayValue(d: DailyPoint, m: DailyMetric): number | null {
  if (m === "pnl") return d.pnlJpy;
  if (m === "pips") return d.pips;
  if (m === "r") return d.rCount > 0 ? d.r : null;
  if (m === "count") return d.n;
  return d.n > 0 ? round((d.wins / d.n) * 100, 1) : null;
}

/** その日までの累積（勝率・件数は日次の合計を積み上げて都度計算する） */
export function cumulativeValue(d: DailyPoint, m: DailyMetric): number {
  if (m === "pnl") return d.cumulativePnlJpy;
  if (m === "pips") return d.cumulativePips;
  if (m === "r") return d.cumulativeR;
  // winRate・countは1点だけでは計算できないので cumulativeSeries を使う
  return m === "count" ? d.n : d.n > 0 ? round((d.wins / d.n) * 100, 1) : 0;
}

/** 系列全体での累積値。勝率・件数は、そこまでの合計から都度計算し直す */
export function cumulativeSeries(
  daily: DailyPoint[],
  m: DailyMetric,
): number[] {
  if (m !== "winRate" && m !== "count") {
    return daily.map((d) => cumulativeValue(d, m));
  }
  let n = 0;
  let wins = 0;
  return daily.map((d) => {
    n += d.n;
    wins += d.wins;
    return m === "count" ? n : n > 0 ? round((wins / n) * 100, 1) : 0;
  });
}

export function formatMetric(v: number | null, m: DailyMetric): string {
  if (m === "pnl") return formatYenSigned(v);
  if (m === "pips") return formatPips(v);
  if (m === "r") return formatR(v);
  if (m === "count") return v === null ? "—" : `${v}件`;
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

/** 軸ラベル用の短い表記（単位なし） */
export function formatAxis(v: number, m: DailyMetric): string {
  if (m === "pnl") return Math.round(v).toLocaleString("ja-JP");
  if (m === "pips") return v.toFixed(0);
  if (m === "count" || m === "winRate") return v.toFixed(0);
  return v.toFixed(1);
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

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

/** 「2026/10/21(火)」 */
export function fullDate(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${date.replace(/-/g, "/")}(${DOW[dow]})`;
}

/** 軸・凡例用の短いラベル。間隔に応じて「10/21」「10/21週」「'26/10」「2026」になる */
export function shortLabel(date: string, g: Granularity): string {
  if (g === "day") return shortDate(date);
  if (g === "week") return `${shortDate(date)}週`;
  if (g === "month") {
    const [y, m] = date.split("-");
    return `'${y.slice(2)}/${Number(m)}`;
  }
  return date.slice(0, 4);
}

/** ツールチップ見出し用の長いラベル。週は月曜〜日曜の範囲も添える */
export function fullLabel(date: string, g: Granularity): string {
  if (g === "day") return fullDate(date);
  if (g === "week") {
    const [y, m, d] = date.split("-").map(Number);
    const end = new Date(Date.UTC(y, m - 1, d + 6));
    const endLabel = `${end.getUTCMonth() + 1}/${end.getUTCDate()}`;
    return `${date.replace(/-/g, "/")}週（〜${endLabel}）`;
  }
  if (g === "month") {
    const [y, m] = date.split("-");
    return `${y}年${Number(m)}月`;
  }
  return `${date.slice(0, 4)}年`;
}
