import { describe, it, expect } from "vitest";
import { validateRule } from "../../../src/services/note/validationCalc";
import type { Rule, TradeView } from "../../../src/types/trade";

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: "r1",
  title: "SLを必ず入れる",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: null,
  validationTargetN: 3,
  validationStartedAt: "2026-10-10T00:00:00Z",
  ...over,
});

const t = (
  day: number,
  r: number | null,
  result?: "ok" | "ng" | "na",
  over: Partial<TradeView> = {},
) =>
  ({
    status: "closed",
    pips: r === null ? 1 : r * 10,
    rMultiple: r,
    entryAt: `2026-10-${String(day).padStart(2, "0")}T01:00:00Z`,
    ruleResults: result
      ? [{ ruleId: "r1", title: "x", result, isActive: true }]
      : [],
    ...over,
  }) as TradeView;

describe("validateRule", () => {
  it("ルール化していなければ null", () => {
    expect(validateRule(rule({ validationStartedAt: null }), [])).toBeNull();
  });

  it("開始前後で件数と平均Rを分け、守った時・破った時も出す", () => {
    const v = validateRule(rule(), [
      t(5, -1),
      t(6, 1),
      t(11, 2, "ok"),
      t(12, -1, "ng"),
      t(13, 1, "ok"),
    ]);
    expect(v).toMatchObject({
      count: 3,
      target: 3,
      reached: true,
      before: { n: 2, avgR: 0 },
      after: { n: 3, avgR: 0.67 },
      kept: { n: 2, avgR: 1.5 },
      broken: { n: 1, avgR: -1 },
    });
  });

  it("目標件数に届かなければ reached は false", () => {
    expect(validateRule(rule(), [t(11, 1, "ok")])).toMatchObject({
      count: 1,
      reached: false,
    });
  });

  it("未決済・SLなしは件数の扱いが正しい（SLなしは件数に入るがRには入らない）", () => {
    const v = validateRule(rule(), [
      t(11, null, "ok"),
      t(12, 2, "ok"),
      t(13, 1, undefined, { status: "open", pips: null } as Partial<TradeView>),
    ]);
    expect(v).toMatchObject({ count: 2, after: { n: 1, avgR: 2 } });
  });

  it("判定が無い（手動チェックなし）トレードは、守った・破ったのどちらにも入れない", () => {
    const v = validateRule(rule(), [t(11, 1), t(12, 1, "na")]);
    expect(v).toMatchObject({
      kept: { n: 0, avgR: null },
      broken: { n: 0, avgR: null },
    });
  });
});
