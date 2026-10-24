import { describe, it, expect } from "vitest";
import { isMarketOpen } from "../../../src/services/candles/marketHours";

const utc = (s: string) => Date.parse(s) / 1000;

describe("isMarketOpen（金曜17:00〜日曜17:00 ニューヨークは休場）", () => {
  it("平日の昼は開いている", () => {
    expect(isMarketOpen(utc("2026-10-21T12:00:00Z"))).toBe(true);
  });
  it("夏時間: 金曜 16:59 NY（20:59 UTC）は開き、17:00 NY（21:00 UTC）で閉まる", () => {
    expect(isMarketOpen(utc("2026-10-23T20:59:00Z"))).toBe(true);
    expect(isMarketOpen(utc("2026-10-23T21:00:00Z"))).toBe(false);
  });
  it("土曜は終日休み", () => {
    expect(isMarketOpen(utc("2026-10-24T03:00:00Z"))).toBe(false);
    expect(isMarketOpen(utc("2026-10-24T20:00:00Z"))).toBe(false);
  });
  it("夏時間: 日曜 16:59 NY（20:59 UTC）は休み、17:00 NY（21:00 UTC）に開く", () => {
    expect(isMarketOpen(utc("2026-10-25T20:59:00Z"))).toBe(false);
    expect(isMarketOpen(utc("2026-10-25T21:00:00Z"))).toBe(true);
  });
  it("冬時間（11月）: 金曜 22:00 UTC が 17:00 NY で閉まる", () => {
    expect(isMarketOpen(utc("2026-11-06T21:59:00Z"))).toBe(true);
    expect(isMarketOpen(utc("2026-11-06T22:00:00Z"))).toBe(false);
  });
});
