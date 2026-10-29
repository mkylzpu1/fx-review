import { describe, it, expect } from "vitest";
import {
  cumulativeValue,
  dayCounts,
  dayValue,
  formatAxis,
  formatMetric,
  shortDate,
} from "../utils/daily";
import type { DailyPoint } from "../types";

const d = (over: Partial<DailyPoint> = {}): DailyPoint => ({
  date: "2026-10-05",
  n: 2,
  wins: 1,
  pips: 10,
  pnlJpy: 1000,
  r: 0.5,
  rCount: 2,
  cumulativePips: 30,
  cumulativePnlJpy: 3000,
  cumulativeR: 1.5,
  ...over,
});

describe("日々の成長 utils", () => {
  it("指標ごとに日次値・累積値を返す", () => {
    expect(dayValue(d(), "pnl")).toBe(1000);
    expect(dayValue(d(), "pips")).toBe(10);
    expect(dayValue(d(), "r")).toBe(0.5);
    expect(cumulativeValue(d(), "pnl")).toBe(3000);
    expect(cumulativeValue(d(), "pips")).toBe(30);
    expect(cumulativeValue(d(), "r")).toBe(1.5);
  });

  it("Rが計算できた取引が無い日は null", () => {
    expect(dayValue(d({ rCount: 0, r: 0 }), "r")).toBeNull();
  });

  it("表記と日付", () => {
    expect(formatMetric(-800, "pnl")).toBe("−¥800");
    expect(formatMetric(12, "pips")).toBe("+12.0 pips");
    expect(formatAxis(12345.6, "pnl")).toBe("12,346");
    expect(shortDate("2026-10-05")).toBe("10/5");
  });

  it("プラス・マイナスの日数を数える（ゼロとR無しは数えない）", () => {
    const days = [d(), d({ pnlJpy: -5 }), d({ pnlJpy: 0 })];
    expect(dayCounts(days, "pnl")).toEqual({ days: 3, plus: 1, minus: 1 });
    expect(dayCounts([d({ rCount: 0 })], "r")).toEqual({
      days: 1,
      plus: 0,
      minus: 0,
    });
  });
});
