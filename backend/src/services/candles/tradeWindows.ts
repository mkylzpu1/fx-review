import type { TradeSpan } from "../../stores/excursionStore";

const DAY_SEC = 86_400;
/** 1トレードあたりに広げる日数の上限（設定値が大きくても、取り込む範囲が無制限にならないように） */
export const MAX_SPAN_DAYS = 366;

export interface Window {
  /** UTC秒（from を含み、to を含まない） */
  from: number;
  to: number;
}

/**
 * トレードごとに「1日足で見せる範囲」（エントリーの前 N 日〜決済の後 M 日）を作り、
 * 重なる・隣り合う範囲をまとめる。同じ範囲を何度も取り込まないため。
 * 未決済はエントリーの時刻を終わりとする。結果は from の昇順。
 */
export function tradeWindows(spans: TradeSpan[], nowSec: number): Window[] {
  const raw = spans
    .map((s) => {
      const end = Math.max(s.exitAt ?? s.entryAt, s.entryAt);
      const before = Math.min(Math.max(s.daysBefore, 0), MAX_SPAN_DAYS);
      const after = Math.min(Math.max(s.daysAfter, 0), MAX_SPAN_DAYS);
      return {
        from: Math.floor((s.entryAt - before * DAY_SEC) / DAY_SEC) * DAY_SEC,
        // 決済日の翌日0時（UTC）まで含める
        to: Math.min(
          Math.floor((end + after * DAY_SEC) / DAY_SEC + 1) * DAY_SEC,
          nowSec,
        ),
      };
    })
    .filter((w) => w.to > w.from)
    .sort((a, b) => a.from - b.from);

  const out: Window[] = [];
  for (const w of raw) {
    const last = out[out.length - 1];
    if (last && w.from <= last.to) last.to = Math.max(last.to, w.to);
    else out.push({ ...w });
  }
  return out;
}
