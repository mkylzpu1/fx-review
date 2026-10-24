import { describe, it, expect } from "vitest";
import { calcEma } from "../ema";

const c = (closes: number[]) =>
  closes.map((close, i) => ({ time: 1000 + i * 60, close }));

describe("calcEma", () => {
  it("period 本目から返し、最初の値は単純平均", () => {
    const r = calcEma(c([1, 2, 3, 4]), 3);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ time: 1000 + 2 * 60, value: 2 });
  });

  it("以降は k = 2/(period+1) で更新する", () => {
    const r = calcEma(c([1, 2, 3, 4]), 3);
    // k = 0.5 → 4*0.5 + 2*0.5 = 3
    expect(r[1].value).toBeCloseTo(3, 10);
  });

  it("period=1 は終値そのもの", () => {
    const r = calcEma(c([5, 7, 6]), 1);
    expect(r.map((p) => p.value)).toEqual([5, 7, 6]);
  });

  it("足が period 本に満たないときは空", () => {
    expect(calcEma(c([1, 2]), 3)).toEqual([]);
  });

  it("不正な period（0・負・小数・NaN）は空", () => {
    for (const p of [0, -1, 2.5, NaN]) {
      expect(calcEma(c([1, 2, 3, 4]), p)).toEqual([]);
    }
  });

  it("一定の終値ならEMAも一定", () => {
    const r = calcEma(c(Array(30).fill(150)), 20);
    expect(r.every((p) => p.value === 150)).toBe(true);
  });
});
