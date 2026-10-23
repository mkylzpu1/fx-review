import { describe, it, expect } from "vitest";
import {
  slPips,
  tpPips,
  resultPips,
  rMultiple,
  riskReward,
  riskJpy,
  riskPct,
  pnlFromPips,
  validatePlan,
  holdMinutes,
} from "../tradeCalc";
import { judgeAuto } from "../ruleJudge";

describe("価格・損益計算", () => {
  it("買い: SL/TP/結果pips", () => {
    expect(slPips(150.0, 149.8, 0.01)).toBe(20);
    expect(tpPips(150.0, 150.4, 0.01)).toBe(40);
    expect(resultPips("buy", 150.0, 150.123, 0.01)).toBe(12.3);
  });
  it("売りは損益の符号が反転する", () => {
    expect(resultPips("sell", 150.0, 149.8, 0.01)).toBe(20);
    expect(resultPips("sell", 150.0, 150.1, 0.01)).toBe(-10);
  });
  it("SLなしは R・RR・リスクが null", () => {
    expect(slPips(150, null, 0.01)).toBeNull();
    expect(rMultiple(10, null)).toBeNull();
    expect(riskReward(null, 40)).toBeNull();
    expect(riskJpy(null, 1000, 1)).toBeNull();
    expect(riskPct(null, 750000)).toBeNull();
  });
  it("R倍数とRR（RRが最低値ちょうどの境界を含む）", () => {
    expect(rMultiple(-20, 20)).toBe(-1);
    expect(rMultiple(30, 20)).toBe(1.5);
    expect(riskReward(20, 40)).toBe(2);
  });
  it("想定リスク円と口座に対する%: 20pips・0.1lot・残高75万円", () => {
    const r = riskJpy(20, 1000, 0.1);
    expect(r).toBe(2000);
    expect(riskPct(r, 750000)).toBe(0.27);
  });
  it("手入力の円損益 = pips × 1lot1pip円 × lots", () => {
    expect(pnlFromPips(12.3, 1000, 0.1)).toBe(1230);
    expect(pnlFromPips(-20, 1000, 0.5)).toBe(-10000);
  });
  it("保有時間", () => {
    expect(holdMinutes("2026-10-01T00:00:00Z", "2026-10-01T01:30:00Z")).toBe(
      90,
    );
    expect(holdMinutes("2026-10-01T00:00:00Z", null)).toBeNull();
  });
});

describe("validatePlan", () => {
  it("買い: SLはエントリーより低く、TPは高く", () => {
    expect(validatePlan("buy", 150, 149.8, 150.4)).toEqual({});
    expect(validatePlan("buy", 150, 150.2, 149.9).sl).toBeDefined();
    expect(validatePlan("buy", 150, 150, null).sl).toBeDefined();
    expect(validatePlan("buy", 150, null, 149.9).tp).toBeDefined();
  });
  it("売り: SLはエントリーより高く、TPは低く", () => {
    expect(validatePlan("sell", 150, 150.2, 149.6)).toEqual({});
    expect(validatePlan("sell", 150, 149.8, null).sl).toBeDefined();
    expect(validatePlan("sell", 150, null, 150.1).tp).toBeDefined();
  });
  it("未入力は検証しない", () => {
    expect(validatePlan("buy", 150, null, null)).toEqual({});
  });
});

describe("judgeAuto", () => {
  const base = {
    hasSl: true,
    hasTp: true,
    riskPct: 0.8,
    maxRiskPct: 1,
    exitMethod: "tp" as const,
  };
  it("sl_set: SLがあればok、無ければna", () => {
    expect(judgeAuto("sl_set", base)).toBe("ok");
    expect(judgeAuto("sl_set", { ...base, hasSl: false })).toBe("na");
  });
  it("risk_within_limit: 上限ちょうどはok、超えたらng、SLなしはna", () => {
    expect(judgeAuto("risk_within_limit", { ...base, riskPct: 1 })).toBe("ok");
    expect(judgeAuto("risk_within_limit", { ...base, riskPct: 1.01 })).toBe(
      "ng",
    );
    expect(judgeAuto("risk_within_limit", { ...base, riskPct: null })).toBe(
      "na",
    );
  });
  it("hold_to_tp: 手動決済ng / TP到達ok / SL到達・TPなしはna", () => {
    expect(judgeAuto("hold_to_tp", { ...base, exitMethod: "manual" })).toBe(
      "ng",
    );
    expect(judgeAuto("hold_to_tp", base)).toBe("ok");
    expect(judgeAuto("hold_to_tp", { ...base, exitMethod: "sl" })).toBe("na");
    expect(
      judgeAuto("hold_to_tp", { ...base, hasTp: false, exitMethod: "manual" }),
    ).toBe("na");
  });
});
