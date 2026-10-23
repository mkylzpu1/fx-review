import { describe, it, expect } from "vitest";
import {
  emptyForm,
  fromTrade,
  isDirty,
  parseNum,
  toPayload,
  validateForm,
  type TradeFormState,
} from "../tradeForm";
import type { Trade } from "../../types";

const base = (o: Partial<TradeFormState> = {}): TradeFormState => ({
  ...emptyForm("USDJPY", "2026-10-01T22:10"),
  lots: "0.1",
  entryPrice: "150.000",
  ...o,
});

describe("validateForm", () => {
  it("必須だけならエラーなし（SL・TP・根拠は任意）", () => {
    expect(validateForm(base())).toEqual({});
  });
  it("必須が空なら項目ごとにエラー", () => {
    const e = validateForm(base({ lots: "", entryPrice: "", entryAt: "" }));
    expect(e.lots).toBe("ロットを入力してください");
    expect(e.entryPrice).toBe("エントリー価格を入力してください");
    expect(e.entryAt).toBe("エントリー日時を入力してください");
  });
  it("ロット: 0以下・小数3桁・数値以外", () => {
    expect(validateForm(base({ lots: "0" })).lots).toContain("0より大きい");
    expect(validateForm(base({ lots: "abc" })).lots).toContain("0より大きい");
    expect(validateForm(base({ lots: "0.123" })).lots).toBe(
      "ロットは小数第2位までです",
    );
    expect(validateForm(base({ lots: "0.25" })).lots).toBeUndefined();
  });
  it("買いのSLは低く、TPは高く", () => {
    expect(validateForm(base({ slPrice: "150.2" })).slPrice).toContain(
      "買いのSL",
    );
    expect(validateForm(base({ tpPrice: "149.5" })).tpPrice).toContain(
      "買いのTP",
    );
    expect(validateForm(base({ slPrice: "149.8", tpPrice: "150.4" }))).toEqual(
      {},
    );
  });
  it("売りは向きが逆", () => {
    const sell = { side: "sell" as const };
    expect(validateForm(base({ ...sell, slPrice: "149.8" })).slPrice).toContain(
      "売りのSL",
    );
    expect(
      validateForm(base({ ...sell, slPrice: "150.2", tpPrice: "149.6" })),
    ).toEqual({});
  });
  it("決済は日時と価格がそろっていて、エントリーより後", () => {
    expect(validateForm(base({ exitAt: "2026-10-01T22:40" })).exitPrice).toBe(
      "決済価格を入力してください",
    );
    expect(validateForm(base({ exitPrice: "150.3" })).exitAt).toBe(
      "決済日時を入力してください",
    );
    expect(
      validateForm(base({ exitAt: "2026-10-01T21:00", exitPrice: "150.3" }))
        .exitAt,
    ).toContain("エントリー日時より後");
    expect(
      validateForm(base({ exitAt: "2026-10-01T22:40", exitPrice: "150.3" })),
    ).toEqual({});
  });
});

describe("toPayload", () => {
  it("空欄は null、日時はJSTのISOにする。決済なしなら決済方法も送らない", () => {
    const p = toPayload(base({ exitMethod: "tp", rationaleMemo: "  " }), false);
    expect(p).toMatchObject({
      lots: 0.1,
      entryAt: "2026-10-01T22:10:00+09:00",
      slPrice: null,
      tpPrice: null,
      rationaleMemo: null,
      exitAt: null,
      exitPrice: null,
      exitMethod: null,
      draft: false,
      tagIds: [],
      ruleChecks: [],
    });
  });
  it("決済ありなら決済方法を送る。下書きフラグ・ルールチェックも反映", () => {
    const p = toPayload(
      base({
        exitAt: "2026-10-01T22:40",
        exitPrice: "150.3",
        exitMethod: "manual",
        ruleChecks: { r1: "ok" },
      }),
      true,
    );
    expect(p).toMatchObject({
      exitAt: "2026-10-01T22:40:00+09:00",
      exitPrice: 150.3,
      exitMethod: "manual",
      draft: true,
      ruleChecks: [{ ruleId: "r1", result: "ok" }],
    });
  });
});

describe("fromTrade / isDirty / parseNum", () => {
  it("保存済みトレードをフォームに戻せる（往復で変わらない）", () => {
    const t = {
      pair: "USDJPY",
      side: "sell",
      lots: 0.3,
      entryAt: "2026-10-21T12:35:00Z",
      entryPrice: 151.2,
      slPrice: null,
      tpPrice: 150.5,
      slReason: null,
      tpReason: null,
      rationaleMemo: "メモ",
      confidence: 3,
      exitAt: null,
      exitPrice: null,
      exitMethod: "open",
      insight: null,
      nextRule: null,
      tags: [{ id: "g1", name: "押し目", kind: "rationale" }],
      ruleChecks: [{ ruleId: "r1", result: "ng" }],
    } as unknown as Trade;
    const f = fromTrade(t);
    expect(f.entryAt).toBe("2026-10-21T21:35");
    expect(f.exitMethod).toBe("");
    expect(f.tagIds).toEqual(["g1"]);
    expect(f.ruleChecks).toEqual({ r1: "ng" });
    expect(isDirty(f, fromTrade(t))).toBe(false);
    expect(isDirty(f, { ...f, lots: "0.4" })).toBe(true);
  });
  it("parseNum", () => {
    expect(parseNum(" ")).toBeNull();
    expect(parseNum("150.25")).toBe(150.25);
    expect(parseNum("1e3")).toBeNaN();
  });
});
