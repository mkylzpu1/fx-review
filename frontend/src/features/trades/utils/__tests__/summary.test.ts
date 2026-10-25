import { describe, it, expect } from "vitest";
import { summarize } from "../summary";
import type { Trade } from "../../types";

const t = (
  pnlJpy: number | null,
  rMultiple: number | null,
  pips: number | null,
) => ({ pnlJpy, rMultiple, pips }) as Trade;

describe("summarize", () => {
  it("空なら全て未計算", () => {
    expect(summarize([])).toEqual({
      closed: 0,
      winRate: null,
      profitFactor: null,
      avgR: null,
      totalPips: 0,
      totalJpy: 0,
      wins: 0,
      losses: 0,
    });
  });
  it("勝率・PF・平均R・合計pips（未決済は数えない）", () => {
    const s = summarize([
      t(3000, 1.5, 30),
      t(-2000, -1, -20),
      t(1000, 0.5, 10),
      t(null, null, null),
    ]);
    expect(s).toEqual({
      closed: 3,
      winRate: 66.67,
      profitFactor: 2,
      avgR: 0.33,
      totalPips: 20,
      totalJpy: 2000,
      wins: 2,
      losses: 1,
    });
  });
  it("Rが出ないトレード（SLなし）は R の集計から外し、勝率には含める", () => {
    const s = summarize([t(1000, null, 10), t(-1000, -1, -10)]);
    expect(s.winRate).toBe(50);
    expect(s.avgR).toBe(-1);
    expect(s.profitFactor).toBe(0);
  });
});
