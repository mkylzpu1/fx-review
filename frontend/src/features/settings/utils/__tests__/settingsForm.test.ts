import { describe, it, expect } from "vitest";
import { validateSettings, maxRiskYen, isSameSettings } from "../settingsForm";
import type { AccountSettings } from "../../types";

const base: AccountSettings = {
  balanceJpy: 750000,
  maxRiskPct: 1,
  minRr: 2,
  timezone: "Asia/Tokyo",
  chartDefaultTf: "15m",
  chartBarsBefore: 120,
  chartBarsAfter: 60,
  emaSettings: [
    { period: 21, visible: true },
    { period: 50, visible: true },
  ],
};

describe("maxRiskYen", () => {
  it("設計の例: 75万円・1% = 7,500円", () => {
    expect(maxRiskYen(750000, 1)).toBe(7500);
  });
  it("端数は切り捨てる", () => {
    expect(maxRiskYen(333333, 1)).toBe(3333);
  });
});

describe("validateSettings", () => {
  it("正常な値はエラーなし", () => {
    expect(validateSettings(base)).toEqual({});
  });
  it("口座残高が0・小数・NaN はエラー", () => {
    expect(
      validateSettings({ ...base, balanceJpy: 0 }).balanceJpy,
    ).toBeDefined();
    expect(
      validateSettings({ ...base, balanceJpy: 1.5 }).balanceJpy,
    ).toBeDefined();
    expect(
      validateSettings({ ...base, balanceJpy: NaN }).balanceJpy,
    ).toBeDefined();
  });
  it("最大リスクは0より大きく100以下", () => {
    expect(
      validateSettings({ ...base, maxRiskPct: 0 }).maxRiskPct,
    ).toBeDefined();
    expect(
      validateSettings({ ...base, maxRiskPct: 100 }).maxRiskPct,
    ).toBeUndefined();
    expect(
      validateSettings({ ...base, maxRiskPct: 101 }).maxRiskPct,
    ).toBeDefined();
  });
  it("EMA期間の重複・0以下はエラー", () => {
    const dup = [
      { period: 9, visible: true },
      { period: 9, visible: false },
    ];
    expect(validateSettings({ ...base, emaSettings: dup }).ema).toContain(
      "重複",
    );
    expect(
      validateSettings({ ...base, emaSettings: [{ period: 0, visible: true }] })
        .ema,
    ).toBeDefined();
  });
});

describe("isSameSettings", () => {
  it("同じ内容なら true、変更があれば false", () => {
    expect(isSameSettings(base, { ...base })).toBe(true);
    expect(isSameSettings(base, { ...base, minRr: 3 })).toBe(false);
  });
});
