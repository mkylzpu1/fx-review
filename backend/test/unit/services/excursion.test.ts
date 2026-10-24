import { describe, it, expect } from "vitest";
import {
  calcExcursion,
  COVERAGE_TOLERANCE_SEC,
  type ExcursionInput,
} from "../../../src/services/candles/excursion";
import type { Candle } from "../../../src/services/candles/CandleProvider";

const sec = (iso: string) => Date.parse(iso) / 1000;
const bar = (
  iso: string,
  o: number,
  h: number,
  l: number,
  c: number,
): Candle => ({
  time: sec(iso),
  open: o,
  high: h,
  low: l,
  close: c,
});

const base: ExcursionInput = {
  side: "buy",
  entryAt: sec("2026-10-21T00:00:30Z"),
  entryPrice: 150.0,
  exitAt: sec("2026-10-21T00:03:10Z"),
  exitPrice: 150.2,
  pipSize: 0.01,
  afterSeconds: 3 * 60,
};

const candles: Candle[] = [
  bar("2026-10-21T00:00:00Z", 150.0, 150.05, 149.9, 150.02), // エントリーの分
  bar("2026-10-21T00:01:00Z", 150.02, 150.3, 150.0, 150.25),
  bar("2026-10-21T00:02:00Z", 150.25, 150.28, 149.95, 150.1),
  bar("2026-10-21T00:03:00Z", 150.1, 150.22, 150.05, 150.2), // 決済の分
  bar("2026-10-21T00:04:00Z", 150.2, 150.5, 150.18, 150.4),
  bar("2026-10-21T00:05:00Z", 150.4, 150.45, 150.3, 150.35),
  bar("2026-10-21T00:10:00Z", 150.35, 151.0, 150.3, 150.9), // 範囲外
];

describe("calcExcursion（買い）", () => {
  it("MFE は保有中の最高値−エントリー、MAE は最安値−エントリー（負）、決済後は決済価格からの伸び", () => {
    expect(calcExcursion(candles, base)).toEqual({
      mfePips: 30, // 150.30 - 150.00
      maePips: -10, // 149.90 - 150.00
      afterMaxPips: 30, // 150.50 - 150.20（決済後3分以内）
    });
  });

  it("決済後の範囲外の足は見ない", () => {
    const r = calcExcursion(candles, { ...base, afterSeconds: 60 });
    expect(r.afterMaxPips).toBe(30);
    const r2 = calcExcursion(
      candles.filter((c) => c.time !== sec("2026-10-21T00:04:00Z")),
      { ...base, afterSeconds: 60 },
    );
    expect(r2.afterMaxPips).toBeNull();
  });

  it("含み損が一度もないときの MAE は 0、含み益が一度もないときの MFE は 0", () => {
    const up = calcExcursion(
      [
        bar("2026-10-21T00:00:00Z", 150.0, 150.1, 150.0, 150.1),
        bar("2026-10-21T00:03:00Z", 150.1, 150.2, 150.1, 150.2),
      ],
      base,
    );
    expect(up.maePips).toBe(0);
    const down = calcExcursion(
      [
        bar("2026-10-21T00:00:00Z", 150.0, 150.0, 149.9, 149.9),
        bar("2026-10-21T00:03:00Z", 149.9, 149.95, 149.8, 149.8),
      ],
      base,
    );
    expect(down.mfePips).toBe(0);
    expect(down.maePips).toBe(-20);
  });
});

describe("calcExcursion（売り）", () => {
  const sell: ExcursionInput = {
    ...base,
    side: "sell",
    entryPrice: 150.0,
    exitPrice: 149.8,
  };
  it("有利は安値側、不利は高値側", () => {
    expect(calcExcursion(candles, sell)).toEqual({
      mfePips: 10, // 150.00 - 149.90
      maePips: -30, // 150.00 - 150.30
      afterMaxPips: 0, // 決済後に 149.8 より下へは行っていない
    });
  });
});

describe("calcExcursion（データが足りないとき）", () => {
  it("保有区間の足が無ければ MFE/MAE は null（決済後は別に判定）", () => {
    const r = calcExcursion(
      candles.filter((c) => c.time > sec("2026-10-21T00:03:00Z")),
      base,
    );
    expect(r.mfePips).toBeNull();
    expect(r.maePips).toBeNull();
    expect(r.afterMaxPips).toBe(30);
  });

  it("エントリー側が許容を超えて欠けていれば null（同期範囲が足りない）", () => {
    const late = candles.map((c) => ({
      ...c,
      time: c.time + COVERAGE_TOLERANCE_SEC + 60,
    }));
    const r = calcExcursion(late.slice(0, 4), {
      ...base,
      exitAt: base.exitAt + COVERAGE_TOLERANCE_SEC + 60,
    });
    expect(r.mfePips).toBeNull();
  });

  it("決済側が許容を超えて欠けていれば null", () => {
    const r = calcExcursion(candles.slice(0, 2), {
      ...base,
      exitAt: base.exitAt + COVERAGE_TOLERANCE_SEC + 120,
    });
    expect(r.mfePips).toBeNull();
    expect(r.maePips).toBeNull();
  });

  it("足が1本も無ければすべて null", () => {
    expect(calcExcursion([], base)).toEqual({
      mfePips: null,
      maePips: null,
      afterMaxPips: null,
    });
  });

  it("エントリーと決済が同じ分でも計算できる", () => {
    const r = calcExcursion(
      [bar("2026-10-21T00:00:00Z", 150.0, 150.1, 149.95, 150.05)],
      { ...base, exitAt: sec("2026-10-21T00:00:50Z") },
    );
    expect(r.mfePips).toBe(10);
    expect(r.maePips).toBe(-5);
  });
});
