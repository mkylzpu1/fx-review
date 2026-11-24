import { describe, it, expect } from "vitest";
import {
  aggregateDaily,
  bucketKey,
  cumulativeSeries,
  cumulativeValue,
  dayCounts,
  dayValue,
  formatAxis,
  fullDate,
  fullLabel,
  formatMetric,
  isSignedMetric,
  shortDate,
  shortLabel,
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
    expect(fullDate("2026-10-05")).toBe("2026/10/05(月)");
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

  it("間隔ごとのバケットキー（週は月曜始まり）", () => {
    expect(bucketKey("2026-10-05", "day")).toBe("2026-10-05");
    // 2026-10-05は月曜
    expect(bucketKey("2026-10-05", "week")).toBe("2026-10-05");
    expect(bucketKey("2026-10-08", "week")).toBe("2026-10-05");
    // 2026-10-04は日曜 → 前週の月曜(2026-09-28)
    expect(bucketKey("2026-10-04", "week")).toBe("2026-09-28");
    expect(bucketKey("2026-10-21", "month")).toBe("2026-10-01");
    expect(bucketKey("2026-10-21", "year")).toBe("2026-01-01");
  });

  it("週・月・年単位にまとめると、件数は合計・累積は最後の値になる", () => {
    const days = [
      d({ date: "2026-10-05", n: 1, pnlJpy: 1000, cumulativePnlJpy: 1000 }),
      d({ date: "2026-10-06", n: 2, pnlJpy: -500, cumulativePnlJpy: 500 }),
      d({ date: "2026-10-12", n: 1, pnlJpy: 2000, cumulativePnlJpy: 2500 }),
    ];
    const weekly = aggregateDaily(days, "week");
    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toMatchObject({
      date: "2026-10-05",
      n: 3,
      pnlJpy: 500,
      cumulativePnlJpy: 500,
    });
    expect(weekly[1]).toMatchObject({
      date: "2026-10-12",
      n: 1,
      pnlJpy: 2000,
      cumulativePnlJpy: 2500,
    });
  });

  it("日単位はそのまま返す", () => {
    const days = [d({ date: "2026-10-05" }), d({ date: "2026-10-06" })];
    expect(aggregateDaily(days, "day")).toBe(days);
  });

  it("間隔ごとのラベル", () => {
    expect(shortLabel("2026-10-05", "day")).toBe("10/5");
    expect(shortLabel("2026-10-05", "week")).toBe("10/5週");
    expect(shortLabel("2026-10-01", "month")).toBe("'26/10");
    expect(shortLabel("2026-01-01", "year")).toBe("2026");

    expect(fullLabel("2026-10-05", "day")).toBe("2026/10/05(月)");
    expect(fullLabel("2026-10-05", "week")).toBe("2026/10/05週（〜10/11）");
    expect(fullLabel("2026-10-01", "month")).toBe("2026年10月");
    expect(fullLabel("2026-01-01", "year")).toBe("2026年");
  });

  it("勝率・トレード数は符号で色分けしない指標", () => {
    expect(isSignedMetric("pnl")).toBe(true);
    expect(isSignedMetric("pips")).toBe(true);
    expect(isSignedMetric("r")).toBe(true);
    expect(isSignedMetric("winRate")).toBe(false);
    expect(isSignedMetric("count")).toBe(false);
  });

  it("勝率・トレード数の日次値", () => {
    expect(dayValue(d({ n: 4, wins: 1 }), "winRate")).toBe(25);
    expect(dayValue(d({ n: 4, wins: 1 }), "count")).toBe(4);
    // n=0の日は無いはずだが、念のため null を返す
    expect(dayValue(d({ n: 0, wins: 0 }), "winRate")).toBeNull();
  });

  it("勝率・トレード数の累積は、そこまでの合計から計算し直す", () => {
    const days = [
      d({ date: "2026-10-01", n: 4, wins: 1 }), // 25%
      d({ date: "2026-10-02", n: 2, wins: 2 }), // 通算 6戦3勝 → 50%
    ];
    expect(cumulativeSeries(days, "winRate")).toEqual([25, 50]);
    expect(cumulativeSeries(days, "count")).toEqual([4, 6]);
  });

  it("勝率・トレード数の表記", () => {
    expect(formatMetric(52.5, "winRate")).toBe("52.5%");
    expect(formatMetric(4, "count")).toBe("4件");
    expect(formatAxis(52.5, "winRate")).toBe("53");
    expect(formatAxis(4, "count")).toBe("4");
  });
});
