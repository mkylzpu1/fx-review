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

  it("時間足を固定すると、その足で取得し、余白は最低6本ぶん取る", () => {
    const r = miniRange(
      {
        entryAt: "2026-10-01T00:00:00Z",
        exitAt: "2026-10-01T00:10:00Z",
      },
      "1h",
    );
    expect(r.tf).toBe("1h");
    // 保有は15分扱い。余白は1時間足6本ぶん（6時間）
    expect(r.range.from).toBe("2026-09-30T18:00:00.000Z");
    expect(r.range.to).toBe("2026-10-01T06:10:00.000Z");
  });

  it("固定した足で本数が多すぎるときは、決済側の240本に絞る", () => {
    const r = miniRange(
      {
        entryAt: "2026-10-01T00:00:00Z",
        exitAt: "2026-10-05T00:00:00Z",
      },
      "5m",
    );
    const bars = (Date.parse(r.range.to) - Date.parse(r.range.from)) / 300_000;
    expect(bars).toBe(240);
    expect(Date.parse(r.range.to)).toBeGreaterThan(Date.parse("2026-10-05"));
  });
});
