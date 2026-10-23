import { describe, it, expect } from "vitest";
import {
  formatHold,
  formatJst,
  formatPips,
  formatPrice,
  formatR,
  formatYenSigned,
  isoToJstInput,
  jstInputToIso,
  priceDigits,
} from "../format";

describe("表示フォーマット", () => {
  it("pips・R・円は符号を付ける（未計算は —）", () => {
    expect(formatPips(38)).toBe("+38.0 pips");
    expect(formatPips(-12.5)).toBe("−12.5 pips");
    expect(formatPips(0)).toBe("0.0 pips");
    expect(formatPips(null)).toBe("—");
    expect(formatR(1.5)).toBe("+1.50R");
    expect(formatR(null)).toBe("—");
    expect(formatYenSigned(11400)).toBe("+¥11,400");
    expect(formatYenSigned(-950)).toBe("−¥950");
  });
  it("価格の桁数はpip幅に合わせる", () => {
    expect(priceDigits(0.01)).toBe(3);
    expect(formatPrice(151.2)).toBe("151.200");
    expect(formatPrice(null)).toBe("—");
  });
  it("JST変換: UTC→JST表記、入力値との往復", () => {
    expect(formatJst("2026-10-01T13:10:00Z")).toBe("2026/10/01 22:10");
    expect(isoToJstInput("2026-10-01T13:10:00Z")).toBe("2026-10-01T22:10");
    expect(jstInputToIso("2026-10-01T22:10")).toBe("2026-10-01T22:10:00+09:00");
    expect(Date.parse(jstInputToIso("2026-10-01T22:10")!)).toBe(
      Date.parse("2026-10-01T13:10:00Z"),
    );
    expect(jstInputToIso("")).toBeNull();
  });
  it("保有時間", () => {
    expect(formatHold(133)).toBe("2時間13分");
    expect(formatHold(5)).toBe("5分");
    expect(formatHold(null)).toBe("—");
  });
});
