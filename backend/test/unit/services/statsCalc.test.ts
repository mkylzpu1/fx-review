import { describe, it, expect } from "vitest";
import {
  cumulativeR,
  dailySeries,
  dateInZone,
  groupBy,
  hourInZone,
  judgeGroup,
  maxDrawdown,
  maxLossStreak,
  profitFactor,
  sessionOf,
  summarize,
  type StatTrade,
} from "../../../src/services/stats/statsCalc";

const t = (
  n: number,
  pips: number | null,
  r: number | null,
  pnl: number | null = null,
): StatTrade => ({
  entryAt: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(),
  pips,
  rMultiple: r,
  pnlJpy: pnl,
});

describe("累積Rと最大ドローダウン", () => {
  it("R が無いトレードは数えず、古い順に累積する", () => {
    const pts = cumulativeR([t(3, 5, 1), t(1, 10, 2), t(2, 3, null)]);
    expect(pts.map((p) => p.cumulative)).toEqual([2, 3]);
    expect(pts.map((p) => p.index)).toEqual([1, 2]);
  });

  it("ピークからの最大下落と区間を返す", () => {
    const pts = cumulativeR([
      t(1, 1, 2),
      t(2, 1, -1),
      t(3, 1, -1.5),
      t(4, 1, 1),
    ]);
    // 累積: 2, 1, -0.5, 0.5 → ピーク2(番号1)から谷-0.5(番号3)で2.5
    expect(maxDrawdown(pts)).toEqual({
      depth: 2.5,
      peakIndex: 1,
      troughIndex: 3,
    });
  });

  it("最初から下がる場合は開始時点（番号0）がピーク", () => {
    const pts = cumulativeR([t(1, -1, -1), t(2, -1, -1)]);
    expect(maxDrawdown(pts)).toEqual({
      depth: 2,
      peakIndex: 0,
      troughIndex: 2,
    });
  });

  it("下落が無ければ null", () => {
    expect(maxDrawdown(cumulativeR([t(1, 1, 1), t(2, 1, 1)]))).toBeNull();
    expect(maxDrawdown([])).toBeNull();
  });
});

describe("PF・連敗", () => {
  it("PF = 総利益R / 総損失R。損失が無ければ null", () => {
    expect(profitFactor([2, -1, 1, -0.5])).toBe(2);
    expect(profitFactor([1, 2])).toBeNull();
  });

  it("最大連敗。建値(0pips)と未決済は連敗を切る／飛ばす", () => {
    const trades = [
      t(1, -1, -1),
      t(2, -2, -1),
      t(3, 0, 0),
      t(4, -1, -1),
      t(5, null, null),
    ];
    expect(maxLossStreak(trades)).toBe(2);
  });
});

describe("summarize（SLなしを含む）", () => {
  it("勝率・pips・円は全件、R系は R があるものだけで、未計算件数を返す", () => {
    const s = summarize([
      t(1, 10, 2, 1000),
      t(2, -5, -1, -500),
      t(3, 8, null, 800),
      t(4, null, null, null),
    ]);
    expect(s.n).toBe(3);
    expect(s.winRate).toBeCloseTo(66.7, 1);
    expect(s.totalPips).toBe(13);
    expect(s.totalPnlJpy).toBe(1300);
    expect(s.rCount).toBe(2);
    expect(s.rMissing).toBe(1);
    expect(s.avgR).toBe(0.5);
    expect(s.profitFactor).toBe(2);
  });

  it("0件でも壊れない", () => {
    const s = summarize([]);
    expect(s).toMatchObject({
      n: 0,
      winRate: null,
      avgR: null,
      rCount: 0,
      totalPips: 0,
    });
  });
});

describe("セッション", () => {
  it("JSTの時刻で東京・ロンドン・NY（日またぎ）・その他に分ける", () => {
    expect(sessionOf(9).key).toBe("tokyo");
    expect(sessionOf(14).key).toBe("tokyo");
    expect(sessionOf(15).key).toBe("other");
    expect(sessionOf(16).key).toBe("london");
    expect(sessionOf(21).key).toBe("ny");
    expect(sessionOf(2).key).toBe("ny");
    expect(sessionOf(6).key).toBe("other");
    expect(sessionOf(7).key).toBe("other");
  });

  it("時刻はタイムゾーンで求める", () => {
    expect(hourInZone("2026-10-01T13:10:00Z", "Asia/Tokyo")).toBe(22);
    expect(hourInZone("2026-10-01T13:10:00Z", "UTC")).toBe(13);
  });
});

describe("強み・弱み・要検証", () => {
  const rs = (n: number, v: number) => Array.from({ length: n }, () => v);

  it("n が15以上なら平均Rの符号で強み・弱み", () => {
    expect(judgeGroup("a", "A", rs(15, 0.5)).verdict).toBe("strength");
    expect(judgeGroup("a", "A", rs(15, -0.2)).verdict).toBe("weakness");
  });

  it("n が14以下は要検証で、あと何件かを返す", () => {
    const g = judgeGroup("a", "A", rs(14, 2));
    expect(g.verdict).toBe("needs_check");
    expect(g.shortfall).toBe(1);
  });

  it("平均Rがちょうど0なら要検証", () => {
    expect(judgeGroup("a", "A", [...rs(8, 1), ...rs(8, -1)]).verdict).toBe(
      "needs_check",
    );
  });

  it("groupBy は R があるものだけ数え、空の区分は出さない", () => {
    const g = groupBy([t(1, 1, 1), t(2, 1, null), t(3, -1, -1)], () => ["x"], [
      { key: "x", label: "X" },
      { key: "y", label: "Y" },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ key: "x", n: 2, avgR: 0 });
  });
});

describe("日ごとの成績と累積", () => {
  const at = (iso: string, pips: number, r: number | null, pnl: number) => ({
    entryAt: iso,
    pips,
    rMultiple: r,
    pnlJpy: pnl,
  });

  it("JSTの暦日でまとめ、累積を持つ（UTC 15:00 以降は翌日）", () => {
    const d = dailySeries(
      [
        at("2026-10-01T14:59:00Z", 10, 1, 1000), // JST 10/1 23:59
        at("2026-10-01T15:00:00Z", -4, -1, -400), // JST 10/2 00:00
        at("2026-10-02T01:00:00Z", 6, null, 600), // JST 10/2
      ],
      "Asia/Tokyo",
    );
    expect(d.map((x) => x.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(d[1]).toMatchObject({
      n: 2,
      wins: 1,
      pips: 2,
      pnlJpy: 200,
      r: -1,
      rCount: 1,
      cumulativePips: 12,
      cumulativePnlJpy: 1200,
      cumulativeR: 0,
    });
  });

  it("R が無い日は rCount 0 で、累積Rは据え置き", () => {
    const d = dailySeries(
      [
        at("2026-10-01T00:00:00Z", 5, 2, 500),
        at("2026-10-02T00:00:00Z", 3, null, 300),
      ],
      "Asia/Tokyo",
    );
    expect(d[1].rCount).toBe(0);
    expect(d[1].cumulativeR).toBe(2);
  });

  it("空なら空、他タイムゾーンも暦日を返す", () => {
    expect(dailySeries([], "Asia/Tokyo")).toEqual([]);
    expect(dateInZone("2026-10-01T20:00:00Z", "America/New_York")).toBe(
      "2026-10-01",
    );
  });
});
