import { describe, it, expect } from "vitest";
import { todayWarnings } from "../utils/todayStatus";
import type { Summary } from "../types";

const sum = (over: Partial<Summary>): Summary => ({
  n: 3,
  winRate: 0,
  totalPips: 0,
  totalPnlJpy: 0,
  rCount: 0,
  rMissing: 0,
  avgR: null,
  totalR: 0,
  profitFactor: null,
  maxLossStreak: 0,
  ...over,
});

describe("todayWarnings", () => {
  it("損失が上限に達したら警告する", () => {
    const w = todayWarnings(sum({ totalPnlJpy: -20000 }), 1_000_000, 2);
    expect(w).toEqual([{ kind: "daily_loss", lossPct: 2, limitPct: 2 }]);
  });
  it("上限が未設定なら損失の警告は出さない", () => {
    expect(
      todayWarnings(sum({ totalPnlJpy: -90000 }), 1_000_000, null),
    ).toEqual([]);
  });
  it("3連敗で警告する", () => {
    const w = todayWarnings(sum({ maxLossStreak: 3 }), 1_000_000, null);
    expect(w).toEqual([{ kind: "loss_streak", streak: 3 }]);
  });
  it("利益や2連敗では警告しない", () => {
    expect(
      todayWarnings(sum({ totalPnlJpy: 5000, maxLossStreak: 2 }), 1_000_000, 1),
    ).toEqual([]);
  });
});
