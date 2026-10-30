import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInclusive,
  eachDay,
  fetchBounds,
  localDate,
  localDateTime,
  presetRange,
  validateRange,
} from "../dateUtils";

describe("localDate / localDateTime", () => {
  it("JSTの0時前後: UTCでは前日でも、JSでは翌日になる", () => {
    // 2026-10-28 15:00Z = JST 2026-10-29 00:00
    expect(localDate("2026-10-28T15:00:00Z", "Asia/Tokyo")).toBe("2026-10-29");
    expect(localDate("2026-10-28T14:59:00Z", "Asia/Tokyo")).toBe("2026-10-28");
    expect(localDate("2026-10-28T15:00:00Z", "UTC")).toBe("2026-10-28");
  });
  it("YYYY-MM-DD HH:mm で、0時台は 00 になる（24 にならない）", () => {
    expect(localDateTime("2026-10-28T15:05:00Z", "Asia/Tokyo")).toBe(
      "2026-10-29 00:05",
    );
  });
});

describe("期間", () => {
  it("日数・列挙・月またぎ", () => {
    expect(daysInclusive("2026-10-30", "2026-11-02")).toBe(4);
    expect(eachDay("2026-10-30", "2026-11-01")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("検証: 開始が後・31日超・未入力はエラー、31日ちょうどはOK", () => {
    expect(validateRange("2026-10-30", "2026-10-29")).toMatch(/開始日/);
    expect(validateRange("2026-10-01", "2026-11-01")).toMatch(/31日/);
    expect(validateRange("2026-10-01", "2026-10-31")).toBeNull();
    expect(validateRange("", "2026-10-31")).toMatch(/入力/);
  });
  it("プリセットは設定のタイムゾーンの暦日", () => {
    // UTC 2026-10-29 16:00 = JST 2026-10-30 01:00
    const now = new Date("2026-10-29T16:00:00Z");
    expect(presetRange("today", "Asia/Tokyo", now)).toEqual({
      from: "2026-10-30",
      to: "2026-10-30",
    });
    expect(presetRange("yesterday", "Asia/Tokyo", now).from).toBe("2026-10-29");
    expect(presetRange("last7", "Asia/Tokyo", now)).toEqual({
      from: "2026-10-24",
      to: "2026-10-30",
    });
    expect(presetRange("thisMonth", "Asia/Tokyo", now).from).toBe("2026-10-01");
  });
  it("取得範囲は前後に余裕を持たせる", () => {
    expect(fetchBounds("2026-10-29", "2026-10-29")).toEqual({
      from: "2026-10-28T00:00:00.000Z",
      to: "2026-10-31T00:00:00.000Z",
    });
  });
});
