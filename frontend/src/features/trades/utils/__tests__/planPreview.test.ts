import { describe, it, expect } from "vitest";
import { buildPlanPreview } from "../planPreview";
import { emptyForm, type TradeFormState } from "../tradeForm";
import type { AccountSettings, CurrencyPair } from "@/features/settings/types";
import type { Rule } from "@/features/rules/types";

const pair: CurrencyPair = {
  id: "p",
  symbol: "USDJPY",
  pipSize: 0.01,
  pipValueJpyPerLot: 1000,
  showInPicker: true,
};
const settings = {
  balanceJpy: 750000,
  maxRiskPct: 1,
  minRr: 1.5,
} as AccountSettings;
const form = (o: Partial<TradeFormState> = {}): TradeFormState => ({
  ...emptyForm("USDJPY", "2026-10-01T22:10"),
  lots: "0.1",
  entryPrice: "150",
  ...o,
});
const rule = (o: Partial<Rule>): Rule => ({
  id: "r",
  title: "r",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: null,
  validationTargetN: 10,
  validationStartedAt: null,
  ...o,
});

describe("buildPlanPreview", () => {
  it("SLなしならリスク・RRは出ない（警告もなし）", () => {
    const p = buildPlanPreview(form(), pair, settings, []);
    expect(p).toMatchObject({
      slPips: null,
      rr: null,
      riskJpy: null,
      riskPct: null,
      warnings: [],
    });
  });
  it("SL・TPからpips・RR・想定リスクを計算する", () => {
    const p = buildPlanPreview(
      form({ slPrice: "149.8", tpPrice: "150.4" }),
      pair,
      settings,
      [],
    );
    expect(p.slPips).toBe(20);
    expect(p.tpPips).toBe(40);
    expect(p.rr).toBe(2);
    expect(p.riskJpy).toBe(2000);
    expect(p.riskPct).toBe(0.27);
    expect(p.warnings).toEqual([]);
  });
  it("RRが最低値未満・リスクが上限超えは注意を出す（保存は止めない）", () => {
    const low = buildPlanPreview(
      form({ slPrice: "149.8", tpPrice: "150.2" }),
      pair,
      settings,
      [],
    );
    expect(low.warnings[0]).toContain("RR");
    expect(low.warnings[0]).toContain("保存はできます");
    const big = buildPlanPreview(
      form({ lots: "0.5", slPrice: "149.8" }),
      pair,
      settings,
      [],
    );
    expect(big.warnings.some((w) => w.includes("上限"))).toBe(true);
  });
  it("決済価格から結果の見込み（pips・R）を出す", () => {
    const p = buildPlanPreview(
      form({
        slPrice: "149.8",
        exitAt: "2026-10-01T22:40",
        exitPrice: "150.3",
      }),
      pair,
      settings,
      [],
    );
    expect(p.resultPips).toBe(30);
    expect(p.resultR).toBe(1.5);
  });
  it("自動判定ルールの見込み: SLがなければ na、入れれば ok", () => {
    const rules = [rule({ id: "a", autoKey: "sl_set" }), rule({ id: "m" })];
    expect(buildPlanPreview(form(), pair, settings, rules).autoResults).toEqual(
      { a: "na" },
    );
    expect(
      buildPlanPreview(form({ slPrice: "149.8" }), pair, settings, rules)
        .autoResults,
    ).toEqual({ a: "ok" });
  });
});
