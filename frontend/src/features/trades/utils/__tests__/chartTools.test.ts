import { beforeEach, describe, expect, it } from "vitest";
import type { Trade } from "../../types";
import { loadChartPrefs, saveChartPrefs } from "../chartPrefs";
import { DEFAULT_OVERLAYS } from "../chartOverlays";
import { excursionInsight, excursionLevels } from "../excursionLevels";
import { formatDuration, measure } from "../measure";

describe("measure", () => {
  it("価格差をpipsに、足の数と時間を絶対値で返す", () => {
    const a = { price: 150, logical: 10, timeSec: 0 };
    const b = { price: 149.88, logical: 18, timeSec: 8 * 3600 };
    expect(measure(a, b, 0.01)).toEqual({ pips: -12, bars: 8, seconds: 28800 });
    expect(measure(b, a, 0.01).pips).toBe(12);
  });
  it("同じ価格は 0（-0 にしない）", () => {
    const p = { price: 150, logical: 1, timeSec: 0 };
    expect(Object.is(measure(p, p, 0.01).pips, 0)).toBe(true);
  });
  it("時間の表記", () => {
    expect(formatDuration(45 * 60)).toBe("45分");
    expect(formatDuration(2 * 3600 + 13 * 60)).toBe("2時間13分");
    expect(formatDuration(3 * 86400 + 4 * 3600)).toBe("3日4時間");
  });
});

const base = {
  side: "buy",
  entryPrice: 150,
  exitPrice: 150.3,
  slPrice: 149.8,
  tpPrice: 150.5,
  mfePips: 40,
  maePips: -10,
  afterMaxPips: 5,
} as unknown as Trade;

describe("excursionLevels", () => {
  it("買い: 上が有利", () => {
    expect(excursionLevels(base, 0.01)).toEqual({
      mfe: 150.4,
      mae: 149.9,
      afterMax: 150.35,
    });
  });
  it("売り: 下が有利", () => {
    const sell = { ...base, side: "sell", exitPrice: 149.7 } as Trade;
    expect(excursionLevels(sell, 0.01)).toEqual({
      mfe: 149.6,
      mae: 150.1,
      afterMax: 149.65,
    });
  });
  it("未決済・値なしは出さない", () => {
    expect(
      excursionLevels({ ...base, exitPrice: null } as Trade, 0.01).mfe,
    ).toBeNull();
    expect(
      excursionLevels({ ...base, mfePips: null } as Trade, 0.01).mfe,
    ).toBeNull();
  });
  it("SLまでの余裕とTPへの到達度", () => {
    expect(excursionInsight(base, 0.01)).toEqual({
      slPips: 20,
      tpPips: 50,
      slMarginPips: 10,
      tpReachPct: 80,
    });
  });
});

describe("chartPrefs", () => {
  beforeEach(() => localStorage.clear());
  it("保存した内容を読み戻す。後から増えた凡例は初期値で補う", () => {
    saveChartPrefs({
      tf: "5m",
      tf2: "1h",
      emas: [{ period: 20, visible: false }],
      showAfter: false,
      fixedY: true,
      dual: true,
      overlays: { ...DEFAULT_OVERLAYS, slLine: false },
    });
    const p = loadChartPrefs();
    expect(p.tf).toBe("5m");
    expect(p.overlays?.slLine).toBe(false);
    localStorage.setItem(
      "fxr.chartPrefs.v1",
      JSON.stringify({ overlays: { slLine: false } }),
    );
    expect(loadChartPrefs().overlays?.excursion).toBe(false);
  });
  it("不正な値は捨てる", () => {
    localStorage.setItem(
      "fxr.chartPrefs.v1",
      JSON.stringify({
        tf: "9h",
        emas: [{ period: 0, visible: true }],
        dual: "x",
      }),
    );
    expect(loadChartPrefs()).toEqual({});
  });
});
