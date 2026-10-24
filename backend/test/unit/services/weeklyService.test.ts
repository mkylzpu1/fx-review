import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/ruleStore", () => ({
  ruleStore: { list: vi.fn(), findById: vi.fn() },
}));
vi.mock("../../../src/stores/weeklyReviewStore", () => ({
  weeklyReviewStore: { find: vi.fn(), upsert: vi.fn() },
}));
vi.mock("../../../src/services/trade/tradeService", () => ({
  tradeService: { listAll: vi.fn() },
}));

import { ruleStore } from "../../../src/stores/ruleStore";
import { weeklyReviewStore } from "../../../src/stores/weeklyReviewStore";
import { tradeService } from "../../../src/services/trade/tradeService";
import { weeklyService } from "../../../src/services/weekly/weeklyService";

const rule = (id: string, isActive: boolean) => ({ id, title: id, isActive });

describe("weeklyService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("週の範囲でトレードを取り、翌週月曜0時ちょうどのトレードは除く。有効なルールだけ候補にする", async () => {
    vi.mocked(tradeService.listAll).mockResolvedValue([
      {
        id: "in",
        status: "closed",
        pips: 5,
        rMultiple: 1,
        entryAt: "2026-10-25T14:59:00Z",
        side: "buy",
        tags: [],
        ruleResults: [],
        exitMethod: "tp",
        deviation: false,
        pnlJpy: 1,
      },
      {
        id: "edge",
        status: "closed",
        pips: 5,
        rMultiple: 1,
        entryAt: "2026-10-25T15:00:00Z",
        side: "buy",
        tags: [],
        ruleResults: [],
        exitMethod: "tp",
        deviation: false,
        pnlJpy: 1,
      },
    ] as never);
    vi.mocked(weeklyReviewStore.find).mockResolvedValue(null);
    vi.mocked(ruleStore.list).mockResolvedValue([
      rule("a", true),
      rule("b", false),
    ] as never);

    const r = await weeklyService.get("u1", "2026-10-21"); // 水曜 → 月曜にそろう
    expect(tradeService.listAll).toHaveBeenCalledWith("u1", {
      from: "2026-10-18T15:00:00.000Z",
      to: "2026-10-25T15:00:00.000Z",
    });
    expect(r.weekStart).toBe("2026-10-19");
    expect(r.n).toBe(1);
    expect(r.rules).toEqual([{ id: "a", title: "a" }]);
    expect(r.review).toBeNull();
  });

  it("他人のルールは「来週守るルール」に選べない", async () => {
    vi.mocked(ruleStore.findById).mockResolvedValue(null);
    await expect(
      weeklyService.save("u1", "2026-10-19", {
        memo: "",
        nextRuleId: "x",
        nextRuleText: null,
      }),
    ).rejects.toThrow("選択したルールが見つかりません");
    expect(weeklyReviewStore.upsert).not.toHaveBeenCalled();
  });

  it("保存は月曜にそろえた週で行う", async () => {
    vi.mocked(weeklyReviewStore.upsert).mockResolvedValue({} as never);
    await weeklyService.save("u1", "2026-10-22", {
      memo: "m",
      nextRuleId: null,
      nextRuleText: "t",
    });
    expect(weeklyReviewStore.upsert).toHaveBeenCalledWith("u1", "2026-10-19", {
      memo: "m",
      nextRuleId: null,
      nextRuleText: "t",
    });
  });
});
