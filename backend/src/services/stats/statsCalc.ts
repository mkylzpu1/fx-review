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

/** 表示タイムゾーンでの曜日（0=日〜6=土） */
export function weekdayInZone(iso: string, timezone: string): number {
  if (timezone === "Asia/Tokyo") {
    return new Date(Date.parse(iso) + JST_OFFSET_MS).getUTCDay();
  }
  const w = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
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

export interface DailyPoint {
  /** エントリー日（表示タイムゾーン・YYYY-MM-DD） */
  date: string;
  n: number;
  wins: number;
  pips: number;
  pnlJpy: number;
  r: number;
  /** R が計算できた件数（0 の日は R が「—」） */
  rCount: number;
  cumulativePips: number;
  cumulativePnlJpy: number;
  cumulativeR: number;
}

/** 表示タイムゾーンでの暦日（YYYY-MM-DD） */
export function dateInZone(iso: string, timezone: string): string {
  if (timezone === "Asia/Tokyo") {
    return new Date(Date.parse(iso) + JST_OFFSET_MS).toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** エントリー日ごとの損益・pips・R と累積（取引のあった日だけ・古い順） */
export function dailySeries(
  trades: StatTrade[],
  timezone: string,
): DailyPoint[] {
  const out: DailyPoint[] = [];
  let cumPips = 0;
  let cumPnl = 0;
  let cumR = 0;
  for (const t of sortAsc(trades)) {
    if (t.pips === null) continue;
    const date = dateInZone(t.entryAt, timezone);
    let day = out[out.length - 1];
    if (!day || day.date !== date) {
      day = {
        date,
        n: 0,
        wins: 0,
        pips: 0,
        pnlJpy: 0,
        r: 0,
        rCount: 0,
        cumulativePips: 0,
        cumulativePnlJpy: 0,
        cumulativeR: 0,
      };
      out.push(day);
    }
    day.n += 1;
    if (t.pips > 0) day.wins += 1;
    day.pips = round(day.pips + t.pips, 1);
    day.pnlJpy = round(day.pnlJpy + (t.pnlJpy ?? 0), 0);
    if (t.rMultiple !== null) {
      day.r = round(day.r + t.rMultiple, 2);
      day.rCount += 1;
    }
    cumPips = round(cumPips + t.pips, 1);
    cumPnl = round(cumPnl + (t.pnlJpy ?? 0), 0);
    cumR = t.rMultiple !== null ? round(cumR + t.rMultiple, 2) : cumR;
    day.cumulativePips = cumPips;
    day.cumulativePnlJpy = cumPnl;
    day.cumulativeR = cumR;
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

/** 直近から数えた連敗数（直近が勝ち・建値なら0）。R未計算のSLなしトレードは対象外 */
export function currentLossStreak(trades: StatTrade[]): number {
  const closed = sortAsc(trades).filter((t) => t.pips !== null);
  let cur = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if ((closed[i].pips as number) < 0) {
      cur += 1;
    } else {
      break;
    }
  }
  return cur;
}

/** ペイオフレシオ（勝ちトレードの平均R ÷ 負けトレードの平均|R|）。どちらかが無ければ null */
export function payoffRatio(rs: number[]): number | null {
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  if (wins.length === 0 || losses.length === 0) return null;
  const avgWin = mean(wins) as number;
  const avgLoss = Math.abs(mean(losses) as number);
  return avgLoss === 0 ? null : round(avgWin / avgLoss, 2);
}

export interface Summary {
  /** 集計対象（決済済み・pips あり）の件数 */
  n: number;
  winRate: number | null;
  /** 勝ちトレードの件数（n - wins が負けトレード件数） */
  wins: number;
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
  /** 直近から数えた連敗数 */
  currentLossStreak: number;
  /** 勝ちトレードの平均R ÷ 負けトレードの平均|R| */
  payoffRatio: number | null;
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
    wins,
    totalPips: round(sum(closed.map((t) => t.pips as number)), 1),
    totalPnlJpy: Math.round(sum(closed.map((t) => t.pnlJpy ?? 0))),
    rCount: rs.length,
    rMissing: closed.length - rs.length,
    avgR: avg === null ? null : round(avg, 2),
    totalR: round(sum(rs), 2),
    profitFactor: profitFactor(rs),
    maxLossStreak: maxLossStreak(closed),
    currentLossStreak: currentLossStreak(closed),
    payoffRatio: payoffRatio(rs),
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

export interface RHistogramBin {
  key: string;
  label: string;
  count: number;
}

const R_BINS: { key: string; label: string; test: (r: number) => boolean }[] =
  [
    { key: "le-2", label: "-2R以下", test: (r) => r <= -2 },
    { key: "-2to-1", label: "-2〜-1R", test: (r) => r > -2 && r <= -1 },
    { key: "-1to0", label: "-1〜0R", test: (r) => r > -1 && r < 0 },
    { key: "0", label: "0R", test: (r) => r === 0 },
    { key: "0to1", label: "0〜1R", test: (r) => r > 0 && r < 1 },
    { key: "1to2", label: "1〜2R", test: (r) => r >= 1 && r < 2 },
    { key: "2to3", label: "2〜3R", test: (r) => r >= 2 && r < 3 },
    { key: "ge3", label: "3R以上", test: (r) => r >= 3 },
  ];

/** Rの分布（区切りごとの件数）。利確が伸ばせているか・損切りが計画通りかを見る */
export function rHistogram(rs: number[]): RHistogramBin[] {
  return R_BINS.map((b) => ({
    key: b.key,
    label: b.label,
    count: rs.filter(b.test).length,
  }));
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

/** 区分ごとの損益・pips・勝率（Rが無いトレードも含め、全件で集計する） */
export interface GroupPnlStat {
  key: string;
  label: string;
  n: number;
  wins: number;
  winRate: number | null;
  pnlJpy: number;
  pips: number;
}

/**
 * 区分キーの配列（トレードごと。無ければ空配列）で、損益・pips・勝率を集計する。
 * groupBy とは違い R の有無を問わず全件を使う（根拠タグ・感情タグ・セッション・時間帯・確信度別の
 * 損益／勝率チャート用）。
 */
export function groupByPnl<T extends StatTrade>(
  trades: T[],
  keysOf: (t: T) => string[],
  labels: { key: string; label: string }[],
): GroupPnlStat[] {
  const bucket = new Map<string, T[]>();
  for (const l of labels) bucket.set(l.key, []);
  for (const t of trades) {
    for (const k of keysOf(t)) bucket.get(k)?.push(t);
  }
  return labels
    .map((l) => {
      const ts = bucket.get(l.key) ?? [];
      const n = ts.length;
      const wins = ts.filter((t) => (t.pips ?? 0) > 0).length;
      return {
        key: l.key,
        label: l.label,
        n,
        wins,
        winRate: n === 0 ? null : round(wins / n, 4),
        pnlJpy: round(
          sum(ts.map((t) => t.pnlJpy ?? 0)),
          0,
        ),
        pips: round(sum(ts.map((t) => t.pips ?? 0)), 1),
      };
    })
    .filter((g) => g.n > 0);
}
