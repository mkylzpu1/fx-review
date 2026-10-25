import type { Trade } from "../types";

export interface TradeSummary {
  /** 決済済みの件数 */
  closed: number;
  winRate: number | null;
  /** R で計算したプロフィットファクター（負けがなければ null） */
  profitFactor: number | null;
  avgR: number | null;
  totalPips: number;
  totalJpy: number;
  wins: number;
  losses: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** 渡されたトレード（一覧に表示中の分など）の簡易集計。決済済みだけを数える */
export function summarize(trades: Trade[]): TradeSummary {
  const closed = trades.filter((t) => t.pnlJpy !== null);
  const wins = closed.filter((t) => (t.pnlJpy ?? 0) > 0).length;
  const rs = closed.flatMap((t) => (t.rMultiple === null ? [] : [t.rMultiple]));
  const gain = rs.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const loss = Math.abs(rs.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  return {
    closed: closed.length,
    winRate: closed.length === 0 ? null : round2((wins / closed.length) * 100),
    profitFactor: loss === 0 ? null : round2(gain / loss),
    avgR:
      rs.length === 0
        ? null
        : round2(rs.reduce((a, b) => a + b, 0) / rs.length),
    totalPips: round2(closed.reduce((a, t) => a + (t.pips ?? 0), 0)),
    totalJpy: closed.reduce((a, t) => a + (t.pnlJpy ?? 0), 0),
    wins,
    losses: closed.filter((t) => (t.pnlJpy ?? 0) < 0).length,
  };
}
