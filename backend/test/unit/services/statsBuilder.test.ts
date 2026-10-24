import { describe, it, expect } from "vitest";
import {
  buildStats,
  UNSET_KEY,
} from "../../../src/services/stats/statsBuilder";
import type { TradeView } from "../../../src/types/trade";

let seq = 0;
/** 必要な項目だけ持つ TradeView（statsBuilder が読む項目のみ） */
function view(over: Partial<TradeView> & { hourJst?: number } = {}): TradeView {
  seq += 1;
  const hour = over.hourJst ?? 10;
  const utc = new Date(Date.UTC(2026, 9, 1, hour - 9, seq)).toISOString();
  return {
    status: "closed",
    entryAt: utc,
    pips: 10,
    rMultiple: 1,
    pnlJpy: 1000,
    tags: [],
    ruleResults: [],
    ...over,
  } as TradeView;
}

describe("buildStats", () => {
  it("決済済みで pips があるものだけ集計する", () => {
    const r = buildStats(
      [
        view(),
        view({ status: "open", pips: null }),
        view({ status: "draft", pips: null }),
      ],
      "Asia/Tokyo",
    );
    expect(r.closedCount).toBe(1);
    expect(r.summary.n).toBe(1);
  });

  it("セッション別は n を併記し、15件未満は要検証", () => {
    const tokyo = Array.from({ length: 3 }, () => view({ hourJst: 10 }));
    const ny = Array.from({ length: 15 }, () =>
      view({ hourJst: 22, rMultiple: -0.5 }),
    );
    const r = buildStats([...tokyo, ...ny], "Asia/Tokyo");
    const t = r.bySession.find((g) => g.key === "tokyo");
    const n = r.bySession.find((g) => g.key === "ny");
    expect(t).toMatchObject({ n: 3, verdict: "needs_check", shortfall: 12 });
    expect(n).toMatchObject({ n: 15, verdict: "weakness" });
  });

  it("根拠タグ別は複数タグを各タグに数え、タグ無しは「未入力」にまとめる", () => {
    const tag = (name: string) => ({
      id: name,
      name,
      kind: "rationale" as const,
    });
    const r = buildStats(
      [
        view({ tags: [tag("押し目買い"), tag("ブレイク")] }),
        view({ tags: [tag("押し目買い")] }),
        view({ tags: [] }),
        view({ tags: [{ id: "e", name: "冷静", kind: "emotion" }] }),
      ],
      "Asia/Tokyo",
    );
    const by = Object.fromEntries(r.byRationale.map((g) => [g.key, g.n]));
    expect(by).toEqual({ 押し目買い: 2, ブレイク: 1, [UNSET_KEY]: 2 });
    // 「未入力」は強み・弱み・要検証の対象にしない
    expect(r.insights.some((i) => i.label === "未入力")).toBe(false);
  });

  it("ルール遵守別: ng があれば破った、ok のみなら守った、無ければ判定なし。無効なルールは見ない", () => {
    const rr = (result: "ok" | "ng" | "na", isActive = true) => ({
      ruleId: "r",
      title: "t",
      result,
      isActive,
    });
    const r = buildStats(
      [
        view({ ruleResults: [rr("ok"), rr("ng")] }),
        view({ ruleResults: [rr("ok")] }),
        view({ ruleResults: [rr("na")] }),
        view({ ruleResults: [rr("ng", false)] }),
      ],
      "Asia/Tokyo",
    );
    const by = Object.fromEntries(r.byRule.map((g) => [g.key, g.n]));
    expect(by).toEqual({ ok: 1, ng: 1, none: 2 });
  });

  it("SLなし（R無し）のトレードは R系から外れ、勝率には入る", () => {
    const r = buildStats(
      [view({ rMultiple: null, pips: 5 }), view({ rMultiple: 2, pips: 10 })],
      "Asia/Tokyo",
    );
    expect(r.summary).toMatchObject({
      n: 2,
      rCount: 1,
      rMissing: 1,
      winRate: 100,
    });
    expect(r.cumulative).toHaveLength(1);
  });
});
