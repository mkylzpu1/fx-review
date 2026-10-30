import type { Trade } from "@/features/trades/types";
import { localDate } from "./dateUtils";

export interface GroupOptions {
  timeZone: string;
  from: string;
  to: string;
  /** true のとき、未決済（open）も含める。下書き（draft）は常に除く */
  includeOpen: boolean;
  /** 利用者が除外したトレードのID */
  excludedIds?: ReadonlySet<string>;
}

const byEntry = (a: Trade, b: Trade) =>
  Date.parse(a.entryAt) - Date.parse(b.entryAt) || a.id.localeCompare(b.id);

/** 対象にするかどうか（状態の判定のみ） */
export function isTargetStatus(t: Trade, includeOpen: boolean): boolean {
  return t.status === "closed" || (includeOpen && t.status === "open");
}

/**
 * エントリー日（設定のタイムゾーン）ごとにまとめる。副作用なしの純関数。
 * 日付は昇順、日の中のトレードはエントリー時刻の昇順（同時刻は id で安定させる）。
 */
export function groupByDay(
  trades: readonly Trade[],
  o: GroupOptions,
): { date: string; trades: Trade[] }[] {
  const days = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!isTargetStatus(t, o.includeOpen)) continue;
    if (o.excludedIds?.has(t.id)) continue;
    const d = localDate(t.entryAt, o.timeZone);
    if (d < o.from || d > o.to) continue;
    const list = days.get(d) ?? [];
    list.push(t);
    days.set(d, list);
  }
  return [...days.keys()]
    .sort()
    .map((date) => ({ date, trades: (days.get(date) ?? []).sort(byEntry) }));
}
