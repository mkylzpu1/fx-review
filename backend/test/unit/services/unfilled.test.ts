import { describe, it, expect } from "vitest";
import {
  computeMissing,
  isUnfilled,
} from "../../../src/services/trade/unfilled";

const base = {
  slPrice: 149.8,
  tpPrice: 150.4,
  exitAt: "2026-10-01T13:00:00Z",
  hasRationaleTag: true,
};

describe("入力のないトレードの定義", () => {
  it("すべて入っていれば対象外", () => {
    expect(isUnfilled(base)).toBe(false);
    expect(computeMissing(base)).toEqual([]);
  });
  it("未決済は対象", () => {
    const t = { ...base, exitAt: null };
    expect(isUnfilled(t)).toBe(true);
    expect(computeMissing(t)).toEqual(["open"]);
  });
  it("SL・TP・根拠タグがすべて空なら対象", () => {
    const t = { ...base, slPrice: null, tpPrice: null, hasRationaleTag: false };
    expect(isUnfilled(t)).toBe(true);
    expect(computeMissing(t)).toEqual(["sl", "tp", "rationale"]);
  });
  it("どれか1つでも入っていれば対象外（未入力タグだけ出る）", () => {
    expect(
      isUnfilled({
        ...base,
        slPrice: null,
        tpPrice: null,
        hasRationaleTag: true,
      }),
    ).toBe(false);
    expect(
      isUnfilled({
        ...base,
        slPrice: 149.8,
        tpPrice: null,
        hasRationaleTag: false,
      }),
    ).toBe(false);
    expect(
      computeMissing({ ...base, tpPrice: null, hasRationaleTag: false }),
    ).toEqual(["tp", "rationale"]);
  });
});
