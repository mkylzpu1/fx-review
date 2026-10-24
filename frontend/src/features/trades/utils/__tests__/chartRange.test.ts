import { describe, it, expect } from "vitest";
import { chartRange, warmupBars, MAX_WARMUP } from "../chartRange";

describe("warmupBars", () => {
  it("最長期間の3倍", () => {
    expect(warmupBars([20, 50, 200])).toBe(600);
  });
  it("EMAが無い・不正のみなら0", () => {
    expect(warmupBars([])).toBe(0);
    expect(warmupBars([NaN, 0])).toBe(0);
  });
  it("上限は2000", () => {
    expect(warmupBars([1000])).toBe(MAX_WARMUP);
  });
});

describe("chartRange", () => {
  const base = {
    entryAt: "2026-10-01T12:00:00.000Z",
    tf: "1h" as const,
    barsBefore: 40,
    barsAfter: 20,
    emaPeriods: [20],
  };

  it("決済済み: エントリーの前 barsBefore 本〜決済の後 barsAfter 本", () => {
    const r = chartRange({ ...base, exitAt: "2026-10-01T14:00:00.000Z" });
    expect(r.from).toBe("2026-09-29T20:00:00.000Z"); // 40時間前
    expect(r.to).toBe("2026-10-02T10:00:00.000Z"); // 決済+20時間
    expect(r.warmup).toBe(60);
  });

  it("未決済: エントリー時刻を基準にする", () => {
    const r = chartRange({ ...base, exitAt: null });
    expect(r.to).toBe("2026-10-02T08:00:00.000Z");
  });

  it("決済がエントリーより前でも範囲が逆転しない", () => {
    const r = chartRange({ ...base, exitAt: "2026-10-01T10:00:00.000Z" });
    expect(Date.parse(r.to)).toBeGreaterThan(Date.parse(r.from));
  });
});
