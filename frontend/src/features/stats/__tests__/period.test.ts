import { describe, it, expect } from "vitest";
import { periodFrom, previousPeriod } from "../utils/period";

describe("periodFrom", () => {
  const now = new Date("2026-10-24T00:34:00Z"); // JST 09:34

  it("すべては指定なし", () => {
    expect(periodFrom("all", now)).toBeUndefined();
  });
  it("今日はJSTの0時（UTCでは前日15時）", () => {
    expect(periodFrom("today", now)).toBe("2026-10-23T15:00:00.000Z");
  });
  it("今日の比較相手は昨日（JSTの0時〜0時）", () => {
    expect(previousPeriod("today", now)).toEqual({
      from: "2026-10-22T15:00:00.000Z",
      to: "2026-10-23T15:00:00.000Z",
    });
  });
  it("過去30日・90日は現在から遡る", () => {
    expect(periodFrom("30d", now)).toBe("2026-09-24T00:34:00.000Z");
    expect(periodFrom("90d", now)).toBe("2026-07-26T00:34:00.000Z");
  });
  it("今月はJSTの月初（UTCでは前日15時）", () => {
    expect(periodFrom("month", now)).toBe("2026-09-30T15:00:00.000Z");
  });
  it("月またぎ直後（JSTでは11/1）は11月の月初", () => {
    expect(periodFrom("month", new Date("2026-10-31T16:00:00Z"))).toBe(
      "2026-10-31T15:00:00.000Z",
    );
  });
});
