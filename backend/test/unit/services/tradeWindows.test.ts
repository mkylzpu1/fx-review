import { describe, expect, it } from "vitest";
import { tradeWindows } from "../../../src/services/candles/tradeWindows";

const D = 86_400;
const T0 = Date.UTC(2026, 9, 10) / 1000;
const NOW = Date.UTC(2026, 9, 24) / 1000;

describe("tradeWindows", () => {
  it("1日足の前後日数ぶん広げ、日の区切りに揃える", () => {
    const [w] = tradeWindows(
      [{ entryAt: T0 + 3600, exitAt: T0 + 7200, daysBefore: 2, daysAfter: 1 }],
      NOW,
    );
    expect(w.from).toBe(T0 - 2 * D);
    expect(w.to).toBe(T0 + 2 * D);
  });

  it("重なる範囲は1つにまとめる", () => {
    const ws = tradeWindows(
      [
        { entryAt: T0, exitAt: T0 + 60, daysBefore: 3, daysAfter: 3 },
        { entryAt: T0 + 2 * D, exitAt: null, daysBefore: 3, daysAfter: 3 },
      ],
      NOW,
    );
    expect(ws).toHaveLength(1);
  });

  it("離れた範囲は分けたまま、現在より先には伸ばさない", () => {
    const ws = tradeWindows(
      [
        { entryAt: T0 - 100 * D, exitAt: null, daysBefore: 1, daysAfter: 1 },
        { entryAt: NOW - 3600, exitAt: null, daysBefore: 1, daysAfter: 60 },
      ],
      NOW,
    );
    expect(ws).toHaveLength(2);
    expect(ws[1].to).toBe(NOW);
  });

  it("トレードが無ければ空", () => {
    expect(tradeWindows([], NOW)).toEqual([]);
  });
});
