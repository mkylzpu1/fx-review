import { describe, it, expect } from "vitest";
import { normalizeTradeInput } from "../../../src/services/trade/tradeInput";
import type { TradeInput } from "../../../src/types/trade";

const input = (o: Partial<TradeInput> = {}): TradeInput => ({
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-10-01T13:10:00Z",
  entryPrice: 150,
  slPrice: null,
  tpPrice: null,
  slReason: null,
  tpReason: null,
  rationaleMemo: null,
  confidence: null,
  exitAt: null,
  exitPrice: null,
  exitMethod: "open",
  insight: null,
  nextRule: null,
  draft: false,
  tagIds: [],
  ruleChecks: [],
  ...o,
});

describe("トレード入力の検証", () => {
  it("SL・TP・根拠なしでも保存できる（未決済→open）", () => {
    expect(normalizeTradeInput(input())).toEqual({
      status: "open",
      exitMethod: "open",
    });
  });
  it("下書きは draft", () => {
    expect(normalizeTradeInput(input({ draft: true })).status).toBe("draft");
  });
  it("決済入力で closed。方法が未指定なら manual", () => {
    expect(
      normalizeTradeInput(
        input({ exitAt: "2026-10-01T13:30:00Z", exitPrice: 150.1 }),
      ),
    ).toEqual({ status: "closed", exitMethod: "manual" });
    expect(
      normalizeTradeInput(
        input({
          exitAt: "2026-10-01T13:30:00Z",
          exitPrice: 150.4,
          exitMethod: "tp",
        }),
      ).exitMethod,
    ).toBe("tp");
  });
  it("決済日時と価格はどちらか片方だけだとエラー", () => {
    expect(() =>
      normalizeTradeInput(input({ exitAt: "2026-10-01T13:30:00Z" })),
    ).toThrow("両方");
    expect(() => normalizeTradeInput(input({ exitPrice: 150.2 }))).toThrow(
      "両方",
    );
  });
  it("買いのSLはエントリーより低く、売りは高く", () => {
    expect(() => normalizeTradeInput(input({ slPrice: 150 }))).toThrow(
      "買いのSL",
    );
    expect(() => normalizeTradeInput(input({ slPrice: 150.2 }))).toThrow();
    expect(
      normalizeTradeInput(input({ side: "sell", slPrice: 150.2 })).status,
    ).toBe("open");
    expect(() =>
      normalizeTradeInput(input({ side: "sell", slPrice: 149.8 })),
    ).toThrow("売りのSL");
  });
  it("TPの向きも検証する", () => {
    expect(() => normalizeTradeInput(input({ tpPrice: 149.5 }))).toThrow(
      "買いのTP",
    );
  });
  it("決済日時がエントリーより前ならエラー。同時刻（秒なしCSV）は許可", () => {
    expect(() =>
      normalizeTradeInput(
        input({ exitAt: "2026-10-01T13:00:00Z", exitPrice: 150.1 }),
      ),
    ).toThrow("決済日時");
    expect(
      normalizeTradeInput(
        input({ exitAt: "2026-10-01T13:10:00Z", exitPrice: 150.1 }),
      ).status,
    ).toBe("closed");
  });
});
