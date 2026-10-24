/**
 * 統計の計算（純粋関数）。R が計算できるトレードだけで R 系を出し、勝率・pips・円は全件で出す（§9.7）。
 */
import { MIN_SAMPLE_FOR_VERDICT } from "../../constants/stats";
import {
  OTHER_SESSION,
  SESSIONS,
  type SessionDef,
} from "../../constants/sessions";
import { round } from "../trade/calc";

export interface StatTrade {
  entryAt: string;
  pips: number | null;
  rMultiple: number | null;
  pnlJpy: number | null;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 表示タイムゾーンでの「時」（0〜23）。Asia/Tokyo 以外は Intl で求める */
export function hourInZone(iso: string, timezone: string): number {
  if (timezone === "Asia/Tokyo") {
    return new Date(Date.parse(iso) + JST_OFFSET_MS).getUTCHours();
  }
  const h = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(new Date(iso));
  return Number(h);
}

export function sessionOf(hour: number): SessionDef {
  for (const s of SESSIONS) {
    const inside =
      s.start <= s.end
        ? hour >= s.start && hour < s.end
        : hour >= s.start || hour < s.end;
    if (inside) return s;
  }
  return OTHER_SESSION;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length === 0 ? null : sum(xs) / xs.length);

/** 古い順に並べる（同時刻は元の順を保つ） */
export function sortAsc<T extends { entryAt: string }>(trades: T[]): T[] {
  return [...trades].sort(
    (a, b) => Date.parse(a.entryAt) - Date.parse(b.entryAt),
  );
}

export interface CumulativePoint {
  /** 1始まりのトレード番号（R が計算できるものだけ数える） */
  index: number;
  entryAt: string;
  r: number;
  cumulative: number;
}

export function cumulativeR(trades: StatTrade[]): CumulativePoint[] {
  let total = 0;
  const out: CumulativePoint[] = [];
  for (const t of sortAsc(trades)) {
    if (t.rMultiple === null) continue;
    total = round(total + t.rMultiple, 2);
    out.push({
      index: out.length + 1,
      entryAt: t.entryAt,
      r: t.rMultiple,
      cumulative: total,
    });
  }
  return out;
}

export interface Drawdown {
  /** ピークからの最大下落（0以下ではなく正の値で返す） */
  depth: number;
  /** ピークのトレード番号 */
  peakIndex: number;
  /** 谷のトレード番号 */
  troughIndex: number;
}

/** 累積Rのピークからの最大下落。開始時点（0）もピークとして扱う（番号0） */
export function maxDrawdown(points: CumulativePoint[]): Drawdown | null {
  if (points.length === 0) return null;
  let peak = 0;
  let peakIdx = 0;
  let best: Drawdown = { depth: 0, peakIndex: 0, troughIndex: 0 };
  for (const p of points) {
    if (p.cumulative > peak) {
      peak = p.cumulative;
      peakIdx = p.index;
    }
    const depth = round(peak - p.cumulative, 2);
    if (depth > best.depth) {
      best = { depth, peakIndex: peakIdx, troughIndex: p.index };
    }
  }
  return best.depth > 0 ? best : null;
}

/** 総利益R / 総損失R。損失が無ければ null（無限大を数値で返さない） */
export function profitFactor(rs: number[]): number | null {
  const gain = sum(rs.filter((r) => r > 0));
  const loss = Math.abs(sum(rs.filter((r) => r < 0)));
  return loss === 0 ? null : round(gain / loss, 2);
}

/** 最大連敗（pips が負のトレードの連続。建値は連敗を切る） */
export function maxLossStreak(trades: StatTrade[]): number {
  let cur = 0;
  let best = 0;
  for (const t of sortAsc(trades)) {
    if (t.pips === null) continue;
    cur = t.pips < 0 ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

export interface Summary {
  /** 集計対象（決済済み・pips あり）の件数 */
  n: number;
  winRate: number | null;
  totalPips: number;
  totalPnlJpy: number;
  /** R が計算できた件数 */
  rCount: number;
  /** R 未計算（SLなし）の件数 */
  rMissing: number;
  avgR: number | null;
  totalR: number;
  profitFactor: number | null;
  maxLossStreak: number;
}

export function summarize(all: StatTrade[]): Summary {
  const closed = all.filter((t) => t.pips !== null);
  const rs = closed.flatMap((t) => (t.rMultiple === null ? [] : [t.rMultiple]));
  const wins = closed.filter((t) => (t.pips as number) > 0).length;
  const avg = mean(rs);
  return {
    n: closed.length,
    winRate:
      closed.length === 0 ? null : round((wins / closed.length) * 100, 1),
    totalPips: round(sum(closed.map((t) => t.pips as number)), 1),
    totalPnlJpy: Math.round(sum(closed.map((t) => t.pnlJpy ?? 0))),
    rCount: rs.length,
    rMissing: closed.length - rs.length,
    avgR: avg === null ? null : round(avg, 2),
    totalR: round(sum(rs), 2),
    profitFactor: profitFactor(rs),
    maxLossStreak: maxLossStreak(closed),
  };
}

export type Verdict = "strength" | "weakness" | "needs_check";

export interface GroupStat {
  key: string;
  label: string;
  /** その区分で R が計算できた件数 */
  n: number;
  avgR: number | null;
  verdict: Verdict;
  /** 要検証のとき、あと何件ほどで判断できるか */
  shortfall: number;
}

/** 区分ごとの n と平均R。n が閾値以上なら平均Rの符号で強み・弱み、未満は要検証 */
export function judgeGroup(
  key: string,
  label: string,
  rs: number[],
  minSample = MIN_SAMPLE_FOR_VERDICT,
): GroupStat {
  const avg = mean(rs);
  const n = rs.length;
  let verdict: Verdict = "needs_check";
  if (n >= minSample && avg !== null && avg !== 0) {
    verdict = avg > 0 ? "strength" : "weakness";
  }
  return {
    key,
    label,
    n,
    avgR: avg === null ? null : round(avg, 2),
    verdict,
    shortfall: Math.max(0, minSample - n),
  };
}

/** 区分キーの配列（トレードごと。無ければ空配列）で集計する。キーの出現順は labels の順 */
export function groupBy<T extends StatTrade>(
  trades: T[],
  keysOf: (t: T) => string[],
  labels: { key: string; label: string }[],
): GroupStat[] {
  const bucket = new Map<string, number[]>();
  for (const l of labels) bucket.set(l.key, []);
  for (const t of trades) {
    if (t.rMultiple === null) continue;
    for (const k of keysOf(t)) bucket.get(k)?.push(t.rMultiple);
  }
  return labels
    .filter((l) => (bucket.get(l.key) ?? []).length > 0)
    .map((l) => judgeGroup(l.key, l.label, bucket.get(l.key) ?? []));
}
