/**
 * 週次レビューの計算（純粋関数）。週は月曜〜日曜（JST）。
 * R系はRが計算できるトレードだけ。「計画どおりR」はTPが入っている手動決済だけが対象（§9.7）。
 */
import { WEEKLY_FEW_TRADES } from "../../constants/stats";
import type { TradeView } from "../../types/trade";
import { round } from "../trade/calc";

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 日付（YYYY-MM-DD）を含む週の月曜（YYYY-MM-DD）。JSTの暦日として扱う */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=日
  return ymd(new Date(d.getTime() - ((dow + 6) % 7) * DAY_MS));
}

/** いまのJSTの日付 */
export function todayJst(now: Date = new Date()): string {
  return ymd(new Date(now.getTime() + JST_OFFSET_MS));
}

/** 週の範囲（from は含む・to は含まない。ISO・UTC） */
export function weekRange(weekStart: string): { from: string; to: string } {
  const startUtc = Date.parse(`${weekStart}T00:00:00Z`) - JST_OFFSET_MS;
  return {
    from: new Date(startUtc).toISOString(),
    to: new Date(startUtc + 7 * DAY_MS).toISOString(),
  };
}

export function addDays(date: string, days: number): string {
  return ymd(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

/** JSTの暦日 */
export function jstDate(iso: string): string {
  return ymd(new Date(Date.parse(iso) + JST_OFFSET_MS));
}

export interface WeeklyTrade {
  id: string;
  entryAt: string;
  side: "buy" | "sell";
  pips: number | null;
  rMultiple: number | null;
  pnlJpy: number | null;
  deviation: boolean;
}

export interface DayStat {
  date: string;
  n: number;
  /** その日のR合計（Rが計算できたものだけ） */
  r: number;
  rCount: number;
}

export interface PlannedComparison {
  /** 対象（TPが入っている手動決済でRが計算できるもの）の件数 */
  eligibleCount: number;
  /** 対象外の手動決済の件数（TPまたはSLが無い） */
  excludedCount: number;
  actualR: number;
  /** 対象を計画どおり（RR）で決済したと仮定した、週全体の合計R */
  plannedTotalR: number;
  /** plannedTotalR − 実際の合計R */
  diffR: number;
  /** 対象トレードの感情タグ（件数の多い順） */
  emotions: { name: string; n: number }[];
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  n: number;
  winRate: number | null;
  totalR: number;
  rCount: number;
  rMissing: number;
  totalPips: number;
  rule: { kept: number; broke: number; none: number };
  days: DayStat[];
  planned: PlannedComparison;
  trades: WeeklyTrade[];
  comments: { kind: "strength" | "weakness" | "note"; text: string }[];
  /** 件数が少ない週。コメントは傾向ではなく見直しの材料 */
  fewTrades: boolean;
}

function ruleBucket(v: TradeView): "kept" | "broke" | "none" {
  const active = v.ruleResults.filter((r) => r.isActive);
  if (active.some((r) => r.result === "ng")) return "broke";
  if (active.some((r) => r.result === "ok")) return "kept";
  return "none";
}

export function buildPlanned(
  closed: TradeView[],
  totalR: number,
): PlannedComparison {
  const manual = closed.filter((v) => v.exitMethod === "manual");
  const eligible = manual.filter(
    (v) => v.tpPrice !== null && v.plannedRr !== null && v.rMultiple !== null,
  );
  const actualR = eligible.reduce((a, v) => a + (v.rMultiple as number), 0);
  const plannedR = eligible.reduce((a, v) => a + (v.plannedRr as number), 0);
  const counts = new Map<string, number>();
  for (const v of eligible)
    for (const t of v.tags)
      if (t.kind === "emotion")
        counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
  return {
    eligibleCount: eligible.length,
    excludedCount: manual.length - eligible.length,
    actualR: round(actualR, 2),
    plannedTotalR: round(totalR - actualR + plannedR, 2),
    diffR: round(plannedR - actualR, 2),
    emotions: [...counts.entries()]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
  };
}

function buildComments(
  days: DayStat[],
  rule: WeeklyStats["rule"],
  n: number,
): WeeklyStats["comments"] {
  const out: WeeklyStats["comments"] = [];
  const withR = days.filter((d) => d.rCount > 0);
  if (withR.length > 0) {
    const best = withR.reduce((a, b) => (b.r > a.r ? b : a));
    const worst = withR.reduce((a, b) => (b.r < a.r ? b : a));
    if (best.r > 0)
      out.push({
        kind: "strength",
        text: `${best.date} が最も良く、合計 +${best.r.toFixed(2)}R でした。`,
      });
    if (worst.r < 0)
      out.push({
        kind: "weakness",
        text: `${worst.date} が最も悪く、合計 −${Math.abs(worst.r).toFixed(2)}R でした。`,
      });
  }
  if (rule.broke > 0)
    out.push({
      kind: "weakness",
      text: `ルールを破ったトレードが ${rule.broke} 件ありました。`,
    });
  else if (rule.kept > 0)
    out.push({
      kind: "strength",
      text: `判定のあるトレードは、すべてルールを守れました（${rule.kept}件）。`,
    });
  if (n > 0 && n < WEEKLY_FEW_TRADES)
    out.push({
      kind: "note",
      text: `${n}件と少ないため、傾向ではなく見直しの材料として見てください。`,
    });
  return out;
}

export function buildWeekly(
  views: TradeView[],
  weekStart: string,
): WeeklyStats {
  const closed = views.filter((v) => v.status === "closed" && v.pips !== null);
  const rs = closed.flatMap((v) => (v.rMultiple === null ? [] : [v.rMultiple]));
  const totalR = round(
    rs.reduce((a, b) => a + b, 0),
    2,
  );
  const wins = closed.filter((v) => (v.pips as number) > 0).length;

  const days: DayStat[] = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    n: 0,
    r: 0,
    rCount: 0,
  }));
  for (const v of closed) {
    const day = days.find((d) => d.date === jstDate(v.entryAt));
    if (!day) continue;
    day.n += 1;
    if (v.rMultiple !== null) {
      day.r = round(day.r + v.rMultiple, 2);
      day.rCount += 1;
    }
  }

  const rule = { kept: 0, broke: 0, none: 0 };
  for (const v of closed) rule[ruleBucket(v)] += 1;

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    n: closed.length,
    winRate:
      closed.length === 0 ? null : round((wins / closed.length) * 100, 1),
    totalR,
    rCount: rs.length,
    rMissing: closed.length - rs.length,
    totalPips: round(
      closed.reduce((a, v) => a + (v.pips as number), 0),
      1,
    ),
    rule,
    days,
    planned: buildPlanned(closed, totalR),
    trades: [...closed]
      .sort((a, b) => Date.parse(b.entryAt) - Date.parse(a.entryAt))
      .map((v) => ({
        id: v.id,
        entryAt: v.entryAt,
        side: v.side,
        pips: v.pips,
        rMultiple: v.rMultiple,
        pnlJpy: v.pnlJpy,
        deviation: v.deviation,
      })),
    comments: buildComments(days, rule, closed.length),
    fewTrades: closed.length < WEEKLY_FEW_TRADES,
  };
}
