import { describe, it, expect } from "vitest";
import { buildRuleDetail } from "../../../src/services/rule/ruleDetailCalc";
import type { Rule, RuleResult, TradeView } from "../../../src/types/trade";

const rule: Rule = {
  id: "r1",
  title: "SLを必ず入れる",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: null,
  validationTargetN: 10,
  validationStartedAt: null,
};

// 2026-10-24(土)。今週の月曜は 10/19
const TODAY = "2026-10-24";

const t = (
  id: string,
  entryAt: string,
  r: number | null,
  result?: RuleResult,
  over: Partial<TradeView> = {},
) =>
  ({
    id,
    entryAt,
    side: "buy",
    status: "closed",
    pips: r === null ? 1 : r * 10,
    rMultiple: r,
    pnlJpy: 100,
    ruleResults: result
      ? [{ ruleId: "r1", title: "x", result, isActive: true }]
      : [],
    ...over,
  }) as TradeView;

describe("buildRuleDetail", () => {
  it("守った・破った・判定なしを数え、判定なしは遵守率の分母に入れない", () => {
    const d = buildRuleDetail(
      rule,
      [
        t("a", "2026-10-20T01:00:00Z", 1, "ok"),
        t("b", "2026-10-21T01:00:00Z", -1, "ng"),
        t("c", "2026-10-22T01:00:00Z", 2, "na"),
        t("d", "2026-10-22T02:00:00Z", 1),
      ],
      TODAY,
    );
    expect(d.kept).toBe(1);
    expect(d.broke).toBe(1);
    expect(d.recent.rate).toBe(50);
    expect(d.weekly).toHaveLength(8);
    expect(d.weekly[7]).toEqual({
      weekStart: "2026-10-19",
      kept: 1,
      broke: 1,
      rate: 50,
    });
  });

  it("判定のある週が無ければ遵守率は null（0%にしない）", () => {
    const d = buildRuleDetail(rule, [], TODAY);
    expect(d.recent.rate).toBeNull();
    expect(d.weekly.every((w) => w.rate === null)).toBe(true);
    expect(d.weekly[0].weekStart).toBe("2026-08-31");
  });

  it("守った時・破った時の平均Rは、Rが計算できるものだけで出す", () => {
    const d = buildRuleDetail(
      rule,
      [
        t("a", "2026-10-20T01:00:00Z", 1, "ok"),
        t("b", "2026-10-21T01:00:00Z", 3, "ok"),
        t("c", "2026-10-21T02:00:00Z", null, "ok"),
        t("d", "2026-10-22T01:00:00Z", -1, "ng"),
      ],
      TODAY,
    );
    expect(d.avgKept).toEqual({ n: 2, avgR: 2 });
    expect(d.avgBroken).toEqual({ n: 1, avgR: -1 });
  });

  it("破ったトレードは新しい順。直近4週より前の判定は直近の遵守率に入らない", () => {
    const d = buildRuleDetail(
      rule,
      [
        t("old", "2026-09-15T01:00:00Z", -1, "ng"),
        t("new", "2026-10-21T01:00:00Z", -1, "ng"),
      ],
      TODAY,
    );
    expect(d.brokenTrades.map((b) => b.id)).toEqual(["new", "old"]);
    expect(d.brokenTotal).toBe(2);
    expect(d.recent.broke).toBe(1);
  });

  it("日曜夜（JST）のトレードは、その週に入れる。月曜0時JSTは翌週", () => {
    // 10/25(日) 23:30 JST = 14:30Z、10/26(月) 00:00 JST = 10/25 15:00Z
    const d = buildRuleDetail(
      rule,
      [
        t("sun", "2026-10-25T14:30:00Z", 1, "ok"),
        t("mon", "2026-10-25T15:00:00Z", 1, "ok"),
      ],
      "2026-10-26",
    );
    expect(d.weekly[7]).toMatchObject({ weekStart: "2026-10-26", kept: 1 });
    expect(d.weekly[6]).toMatchObject({ weekStart: "2026-10-19", kept: 1 });
  });

  it("未決済のトレードは数えない", () => {
    const d = buildRuleDetail(
      rule,
      [
        t("o", "2026-10-20T01:00:00Z", null, "ng", {
          status: "open",
          pips: null,
        }),
      ],
      TODAY,
    );
    expect(d.broke).toBe(0);
  });

  it("ルール化した改善案なら、前後の比較を含める", () => {
    const d = buildRuleDetail(
      { ...rule, validationStartedAt: "2026-10-20T00:00:00Z" },
      [
        t("a", "2026-10-19T01:00:00Z", -1),
        t("b", "2026-10-21T01:00:00Z", 1, "ok"),
      ],
      TODAY,
    );
    expect(d.validation?.count).toBe(1);
    expect(d.validation?.before.avgR).toBe(-1);
  });
});
