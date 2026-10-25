import { describe, it, expect } from "vitest";
import { miniRange, pickTf } from "../components/MiniChart";

describe("一覧の小さなチャート", () => {
  it("保有時間に合わせて時間足を選ぶ", () => {
    expect(pickTf(30 * 60)).toBe("1m");
    expect(pickTf(3 * 3600)).toBe("5m");
    expect(pickTf(2 * 86400)).toBe("1h");
    expect(pickTf(365 * 86400)).toBe("1d");
  });

  it("前後に保有時間の半分ずつ余白を取る", () => {
    const r = miniRange({
      entryAt: "2026-10-01T00:00:00Z",
      exitAt: "2026-10-01T02:00:00Z",
    });
    expect(r.range.from).toBe("2026-09-30T23:00:00.000Z");
    expect(r.range.to).toBe("2026-10-01T03:00:00.000Z");
    expect(r.tf).toBe("5m");
  });
});
