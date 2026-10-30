import { describe, expect, it } from "vitest";
import { groupByDay } from "../groupByDay";
import { makeTrade } from "./fixtures";

const base = {
  timeZone: "Asia/Tokyo",
  from: "2026-10-28",
  to: "2026-10-30",
  includeOpen: false,
};

describe("groupByDay", () => {
  it("エントリー日はJSTで区切る（UTCの日付と違う日になるケース）", () => {
    const a = makeTrade({ entryAt: "2026-10-28T14:59:00Z" }); // JST 10/28 23:59
    const b = makeTrade({ entryAt: "2026-10-28T15:00:00Z" }); // JST 10/29 00:00
    const g = groupByDay([b, a], base);
    expect(g.map((d) => d.date)).toEqual(["2026-10-28", "2026-10-29"]);
    expect(g[0].trades).toEqual([a]);
    expect(g[1].trades).toEqual([b]);
  });
  it("日の中はエントリー時刻の昇順、同時刻はIDで安定", () => {
    const late = makeTrade({ entryAt: "2026-10-29T05:00:00Z" });
    const early = makeTrade({ entryAt: "2026-10-29T01:00:00Z" });
    const [d] = groupByDay([late, early], base);
    expect(d.trades).toEqual([early, late]);
  });
  it("期間外・下書きは除く。未決済は includeOpen のときだけ", () => {
    const out = makeTrade({ entryAt: "2026-11-05T01:00:00Z" });
    const draft = makeTrade({ status: "draft" });
    const open = makeTrade({ status: "open" });
    const closed = makeTrade();
    expect(
      groupByDay([out, draft, open, closed], base).flatMap((d) => d.trades),
    ).toEqual([closed]);
    expect(
      groupByDay([out, draft, open, closed], { ...base, includeOpen: true })
        .flatMap((d) => d.trades)
        .sort(),
    ).toHaveLength(2);
  });
  it("除外したトレードは含めない", () => {
    const a = makeTrade();
    const b = makeTrade();
    const g = groupByDay([a, b], { ...base, excludedIds: new Set([a.id]) });
    expect(g[0].trades).toEqual([b]);
  });
  it("0件なら空配列", () => {
    expect(groupByDay([], base)).toEqual([]);
  });
});
