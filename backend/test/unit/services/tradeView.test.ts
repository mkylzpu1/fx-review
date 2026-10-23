import { describe, it, expect } from "vitest";
import {
  buildTradeView,
  type ViewContext,
} from "../../../src/services/trade/tradeView";
import type { Rule, TradeRecord } from "../../../src/types/trade";

const rule = (o: Partial<Rule>): Rule => ({
  id: "r",
  title: "ルール",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: null,
  validationTargetN: 10,
  validationStartedAt: null,
  ...o,
});

const ctx = (rules: Rule[] = []): ViewContext => ({
  pipSize: 0.01,
  pipValueJpyPerLot: 1000,
  balanceJpy: 750000,
  maxRiskPct: 1,
  rules,
});

const trade = (o: Partial<TradeRecord> = {}): TradeRecord => ({
  id: "t1",
  source: "manual",
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-10-01T13:10:00Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.4,
  slReason: null,
  tpReason: null,
  rationaleMemo: null,
  confidence: null,
  exitAt: "2026-10-01T13:40:00Z",
  exitPrice: 150.3,
  exitMethod: "manual",
  pnlJpy: 3000,
  insight: null,
  nextRule: null,
  status: "closed",
  mfePips: null,
  maePips: null,
  afterMaxPips: null,
  tags: [],
  ruleChecks: [],
  ...o,
});

describe("buildTradeView 導出値", () => {
  it("買い・SLあり: pips/R/RR/リスクが出る", () => {
    const v = buildTradeView(trade(), ctx());
    expect(v.pips).toBe(30);
    expect(v.rMultiple).toBe(1.5);
    expect(v.plannedRr).toBe(2);
    expect(v.riskJpy).toBe(2000);
    expect(v.riskPct).toBe(0.27);
    expect(v.holdMinutes).toBe(30);
  });
  it("売りは符号が反転する", () => {
    const v = buildTradeView(
      trade({ side: "sell", slPrice: 150.2, tpPrice: 149.6, exitPrice: 150.1 }),
      ctx(),
    );
    expect(v.pips).toBe(-10);
    expect(v.rMultiple).toBe(-0.5);
  });
  it("SLなしは R・RR・リスクが null（pipsは出る）", () => {
    const v = buildTradeView(trade({ slPrice: null }), ctx());
    expect(v.pips).toBe(30);
    expect(v.rMultiple).toBeNull();
    expect(v.plannedRr).toBeNull();
    expect(v.riskJpy).toBeNull();
    expect(v.riskPct).toBeNull();
  });
  it("未決済は pips/R/保有時間が null", () => {
    const v = buildTradeView(
      trade({
        exitAt: null,
        exitPrice: null,
        exitMethod: "open",
        status: "open",
      }),
      ctx(),
    );
    expect(v.pips).toBeNull();
    expect(v.rMultiple).toBeNull();
    expect(v.holdMinutes).toBeNull();
    expect(v.missing).toContain("open");
    expect(v.isUnfilled).toBe(true);
  });
});

describe("buildTradeView ルール判定", () => {
  it("自動判定: hold_to_tp は手動決済でNG → 逸脱", () => {
    const v = buildTradeView(
      trade(),
      ctx([rule({ id: "a", title: "TPまで持つ", autoKey: "hold_to_tp" })]),
    );
    expect(v.ruleResults).toEqual([
      { ruleId: "a", title: "TPまで持つ", result: "ng", isActive: true },
    ]);
    expect(v.deviation).toBe(true);
  });
  it("リスク上限: 想定リスクが上限超えならNG（ちょうどは OK）", () => {
    const over = buildTradeView(
      trade({ lots: 0.5 }),
      ctx([rule({ id: "a", autoKey: "risk_within_limit" })]),
    );
    expect(over.riskPct).toBe(1.33);
    expect(over.ruleResults[0].result).toBe("ng");
    const exact = buildTradeView(
      trade({ lots: 0.375 }),
      ctx([rule({ id: "a", autoKey: "risk_within_limit" })]),
    );
    expect(exact.riskPct).toBe(1);
    expect(exact.ruleResults[0].result).toBe("ok");
  });
  it("必要な項目が無い自動判定は na で、逸脱に数えない", () => {
    const v = buildTradeView(
      trade({ slPrice: null, tpPrice: null }),
      ctx([
        rule({ id: "a", autoKey: "risk_within_limit" }),
        rule({ id: "b", autoKey: "hold_to_tp" }),
      ]),
    );
    expect(v.ruleResults.map((x) => x.result)).toEqual(["na", "na"]);
    expect(v.deviation).toBe(false);
  });
  it("手動ルール: チェック済みの結果を返し、未チェックは na", () => {
    const v = buildTradeView(
      trade({ ruleChecks: [{ ruleId: "m1", result: "ng" }] }),
      ctx([rule({ id: "m1" }), rule({ id: "m2" })]),
    );
    expect(v.ruleResults.map((x) => x.result)).toEqual(["ng", "na"]);
    expect(v.deviation).toBe(true);
  });
  it("無効化したルールは、過去の手動チェックだけ残し、逸脱には数えない", () => {
    const v = buildTradeView(
      trade({ ruleChecks: [{ ruleId: "old", result: "ng" }] }),
      ctx([
        rule({ id: "old", isActive: false }),
        rule({ id: "off", isActive: false }),
        rule({ id: "offAuto", isActive: false, autoKey: "sl_set" }),
      ]),
    );
    expect(v.ruleResults).toEqual([
      { ruleId: "old", title: "ルール", result: "ng", isActive: false },
    ]);
    expect(v.deviation).toBe(false);
  });
  it("根拠タグがあれば未入力タグに rationale が出ない", () => {
    const v = buildTradeView(
      trade({ tags: [{ id: "g", name: "押し目", kind: "rationale" }] }),
      ctx(),
    );
    expect(v.missing).toEqual([]);
    const emotionOnly = buildTradeView(
      trade({ tags: [{ id: "g", name: "焦り", kind: "emotion" }] }),
      ctx(),
    );
    expect(emotionOnly.missing).toEqual(["rationale"]);
  });
});
