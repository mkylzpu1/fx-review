import { describe, it, expect } from "vitest";
import {
  addDays,
  buildWeekly,
  mondayOf,
  weekRange,
} from "../../../src/services/weekly/weeklyCalc";
import type { TradeView } from "../../../src/types/trade";

let seq = 0;
function view(over: Partial<TradeView> = {}): TradeView {
  seq += 1;
  return {
    id: `t${seq}`,
    status: "closed",
    side: "buy",
    entryAt: "2026-10-20T01:00:00Z", // JST 火曜 10:00
    pips: 10,
    rMultiple: 1,
    plannedRr: 2,
    tpPrice: 151,
    pnlJpy: 1000,
    exitMethod: "tp",
    tags: [],
    ruleResults: [],
    deviation: false,
    ...over,
  } as TradeView;
}

describe("週の計算", () => {
  it("日付を含む週の月曜を返す（日曜は前の月曜）", () => {
    expect(mondayOf("2026-10-24")).toBe("2026-10-19"); // 土
    expect(mondayOf("2026-10-19")).toBe("2026-10-19"); // 月
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // 日
  });

  it("週の範囲はJSTの月曜0時〜翌月曜0時（UTC）", () => {
    expect(weekRange("2026-10-19")).toEqual({
      from: "2026-10-18T15:00:00.000Z",
      to: "2026-10-25T15:00:00.000Z",
    });
    expect(addDays("2026-10-19", 6)).toBe("2026-10-25");
  });
});

describe("buildWeekly", () => {
  it("勝率・合計R・合計pips・日別R（JSTの日付で振り分け）", () => {
    const w = buildWeekly(
      [
        view({ entryAt: "2026-10-18T16:00:00Z", rMultiple: 2, pips: 20 }), // JST 月 01:00
        view({ entryAt: "2026-10-20T01:00:00Z", rMultiple: -1, pips: -10 }),
        view({ entryAt: "2026-10-20T02:00:00Z", rMultiple: 1, pips: 5 }),
      ],
      "2026-10-19",
    );
    expect(w).toMatchObject({ n: 3, totalR: 2, totalPips: 15 });
    expect(w.winRate).toBeCloseTo(66.7, 1);
    expect(w.days[0]).toMatchObject({ date: "2026-10-19", n: 1, r: 2 });
    expect(w.days[1]).toMatchObject({ date: "2026-10-20", n: 2, r: 0 });
  });

  it("SLなしはR系から外れ、未計算件数に数える", () => {
    const w = buildWeekly([view({ rMultiple: null }), view()], "2026-10-19");
    expect(w).toMatchObject({ n: 2, rCount: 1, rMissing: 1, totalR: 1 });
  });

  it("計画どおりR: TP入りの手動決済だけRRに置き換え、対象外は件数で併記する", () => {
    const w = buildWeekly(
      [
        view({
          exitMethod: "manual",
          rMultiple: 0.5,
          plannedRr: 2,
          tags: [{ id: "e", name: "焦り", kind: "emotion" }],
        }),
        view({
          exitMethod: "manual",
          rMultiple: -1,
          plannedRr: 3,
          tags: [{ id: "e", name: "焦り", kind: "emotion" }],
        }),
        view({
          exitMethod: "manual",
          rMultiple: 1,
          plannedRr: null,
          tpPrice: null,
        }), // TPなし
        view({ exitMethod: "tp", rMultiple: 2 }),
      ],
      "2026-10-19",
    );
    // 実際の合計 = 0.5 - 1 + 1 + 2 = 2.5。対象2件の実際 -0.5 → 計画 5 に置換 → 8
    expect(w.planned).toMatchObject({
      eligibleCount: 2,
      excludedCount: 1,
      actualR: -0.5,
      plannedTotalR: 8,
      diffR: 5.5,
    });
    expect(w.planned.emotions).toEqual([{ name: "焦り", n: 2 }]);
  });

  it("ルール遵守の内訳。無効なルールは見ない", () => {
    const rr = (result: "ok" | "ng", isActive = true) => ({
      ruleId: "r",
      title: "t",
      result,
      isActive,
    });
    const w = buildWeekly(
      [
        view({ ruleResults: [rr("ok")] }),
        view({ ruleResults: [rr("ok"), rr("ng")] }),
        view({ ruleResults: [rr("ng", false)] }),
      ],
      "2026-10-19",
    );
    expect(w.rule).toEqual({ kept: 1, broke: 1, none: 1 });
  });

  it("件数が少ない週は注記を付ける。0件でも壊れない", () => {
    const few = buildWeekly([view(), view(), view(), view()], "2026-10-19");
    expect(few.fewTrades).toBe(true);
    expect(
      few.comments.some(
        (c) => c.kind === "note" && c.text.includes("見直しの材料"),
      ),
    ).toBe(true);
    const none = buildWeekly([], "2026-10-19");
    expect(none).toMatchObject({ n: 0, winRate: null, totalR: 0 });
    expect(none.comments).toEqual([]);
  });

  it("未決済・下書きは数えない", () => {
    const w = buildWeekly(
      [view({ status: "open", pips: null }), view()],
      "2026-10-19",
    );
    expect(w.n).toBe(1);
  });
});
