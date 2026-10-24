import { describe, it, expect } from "vitest";
import { dayLabel, shiftWeek, weekLabel } from "../utils/week";

describe("week utils", () => {
  it("週を前後にずらす（月またぎ・年またぎ）", () => {
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
    expect(shiftWeek("2026-10-26", 1)).toBe("2026-11-02");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  });
  it("週と日のラベル", () => {
    expect(weekLabel("2026-10-19", "2026-10-25")).toBe(
      "10/19（月）〜 10/25（日）",
    );
    expect(dayLabel("2026-10-24")).toBe("10/24(土)");
  });
});
