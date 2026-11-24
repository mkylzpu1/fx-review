import { describe, it, expect } from "vitest";
import { customRange, periodFrom, periodRange, previousPeriod } from "../utils/period";

describe("periodFrom", () => {
  // JST 2026-10-24（土）09:34
  const now = new Date("2026-10-24T00:34:00Z");

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

  it("今週はJSTの月曜0時から（終わりは指定なし＝現在まで）", () => {
    // 2026-10-24（土）なので、今週の月曜は10/19
    expect(periodRange("thisWeek", now)).toEqual({
      from: "2026-10-18T15:00:00.000Z",
    });
  });

  it("先週は先週月曜0時〜今週月曜0時", () => {
    expect(periodRange("lastWeek", now)).toEqual({
      from: "2026-10-11T15:00:00.000Z",
      to: "2026-10-18T15:00:00.000Z",
    });
  });

  it("先月は先月月初〜今月月初", () => {
    expect(periodRange("lastMonth", now)).toEqual({
      from: "2026-08-31T15:00:00.000Z",
      to: "2026-09-30T15:00:00.000Z",
    });
  });

  it("今週の比較相手は先週、先週の比較相手は先々週", () => {
    expect(previousPeriod("thisWeek", now)).toEqual({
      from: "2026-10-11T15:00:00.000Z",
      to: "2026-10-18T15:00:00.000Z",
    });
    expect(previousPeriod("lastWeek", now)).toEqual({
      from: "2026-10-04T15:00:00.000Z",
      to: "2026-10-11T15:00:00.000Z",
    });
  });

  it("今月の比較相手は先月、先月の比較相手は先々月", () => {
    expect(previousPeriod("month", now)).toEqual({
      from: "2026-08-31T15:00:00.000Z",
      to: "2026-09-30T15:00:00.000Z",
    });
    expect(previousPeriod("lastMonth", now)).toEqual({
      from: "2026-07-31T15:00:00.000Z",
      to: "2026-08-31T15:00:00.000Z",
    });
  });

  it("「すべて」「期間を指定」は比較なし", () => {
    expect(previousPeriod("all", now)).toBeNull();
    expect(previousPeriod("custom", now)).toBeNull();
  });

  it("期間を指定（カスタム）は選んだ日付の0時〜終了日の翌日0時", () => {
    expect(customRange("2026-10-01", "2026-10-07")).toEqual({
      from: "2026-09-30T15:00:00.000Z",
      to: "2026-10-07T15:00:00.000Z",
    });
  });
});
