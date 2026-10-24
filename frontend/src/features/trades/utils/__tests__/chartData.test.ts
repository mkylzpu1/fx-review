import { describe, it, expect } from "vitest";
import { buildChartData, candleStartFor } from "../chartData";

const candles = (n: number, start = 0) =>
  Array.from({ length: n }, (_, i) => ({
    time: (start + i) * 3600,
    open: 150,
    high: 150.1,
    low: 149.9,
    close: 150 + i * 0.01,
  }));

describe("candleStartFor", () => {
  it("ts を含む足の開始時刻", () => {
    expect(candleStartFor(candles(5), 2 * 3600 + 1800)).toBe(2 * 3600);
  });
  it("最初の足より前は null", () => {
    expect(candleStartFor(candles(3, 10), 3600)).toBeNull();
  });
});

describe("buildChartData", () => {
  const all = candles(10);

  it("ウォームアップを除いて返し、EMAは全件で計算する", () => {
    const r = buildChartData({
      candles: all,
      warmupCount: 4,
      emaPeriods: [3],
      entrySec: 6 * 3600,
      showAfter: true,
    });
    expect(r.candles).toHaveLength(6);
    // 表示の先頭（4本目）時点でもEMAに値がある＝ウォームアップが効いている
    expect(r.emaLines[0].points[0].time).toBe(4 * 3600);
    expect(r.emaLines[0].points).toHaveLength(6);
    expect(r.entryTime).toBe(6 * 3600);
  });

  it("エントリー後の値動きOFFでエントリーの足より後を隠す", () => {
    const r = buildChartData({
      candles: all,
      warmupCount: 0,
      emaPeriods: [2],
      entrySec: 5 * 3600,
      showAfter: false,
    });
    expect(r.candles.at(-1)?.time).toBe(5 * 3600);
    expect(r.emaLines[0].points.at(-1)?.time).toBe(5 * 3600);
  });

  it("足が無ければ空", () => {
    const r = buildChartData({
      candles: [],
      warmupCount: 0,
      emaPeriods: [20],
      entrySec: 0,
      showAfter: true,
    });
    expect(r.candles).toEqual([]);
    expect(r.entryTime).toBeNull();
  });

  it("足数がEMA期間に満たなければ線は空（エラーにしない）", () => {
    const r = buildChartData({
      candles: candles(3),
      warmupCount: 0,
      emaPeriods: [20],
      entrySec: 0,
      showAfter: true,
    });
    expect(r.emaLines[0].points).toEqual([]);
  });
});
