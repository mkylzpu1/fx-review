import { describe, it, expect, vi } from "vitest";
import {
  DukascopyProvider,
  toCandles,
  type DukascopyRow,
  type FetchRates,
} from "../../../src/services/candles/DukascopyProvider";
import { MockCandleProvider } from "../../../src/services/candles/MockCandleProvider";
import { isMarketOpen } from "../../../src/services/candles/marketHours";

const row = (iso: string, o: number): DukascopyRow => ({
  timestamp: Date.parse(iso),
  open: o,
  high: o + 0.05,
  low: o - 0.05,
  close: o + 0.01,
});

describe("toCandles", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-10-01T00:10:00Z");
  it("ミリ秒を秒に直し、範囲外と不正な値を除き、昇順・重複なしにする", () => {
    const rows = [
      row("2026-10-01T00:02:00Z", 150.2),
      row("2026-10-01T00:01:00Z", 150.1),
      row("2026-10-01T00:01:00Z", 150.15),
      row("2026-09-30T23:59:00Z", 149.9),
      row("2026-10-01T00:10:00Z", 150.9),
      { ...row("2026-10-01T00:03:00Z", 150.3), close: Number.NaN },
    ];
    const out = toCandles(rows, from, to);
    expect(out.map((c) => c.time)).toEqual([
      Date.parse("2026-10-01T00:01:00Z") / 1000,
      Date.parse("2026-10-01T00:02:00Z") / 1000,
    ]);
    expect(out[0].open).toBe(150.15);
  });
});

describe("DukascopyProvider", () => {
  it("1分足・bid・UTC・フラットな足を除く設定で取得元を呼ぶ", async () => {
    const fetchRates = vi.fn<Parameters<FetchRates>, ReturnType<FetchRates>>(
      async () => [row("2026-10-01T00:00:00Z", 150)],
    );
    const p = new DukascopyProvider(fetchRates);
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-01T01:00:00Z");
    const out = await p.fetch1m("USDJPY", from, to);
    expect(out).toHaveLength(1);
    const cfg = fetchRates.mock.calls[0][0];
    expect(cfg).toMatchObject({
      instrument: "usdjpy",
      timeframe: "m1",
      priceType: "bid",
      utcOffset: 0,
      ignoreFlats: true,
      format: "json",
    });
    expect(p.source).toBe("dukascopy");
  });
  it("取得元のエラーはそのまま投げる", async () => {
    const p = new DukascopyProvider(async () => {
      throw new Error("fetch failed");
    });
    await expect(
      p.fetch1m("USDJPY", new Date(0), new Date(60_000)),
    ).rejects.toThrow("fetch failed");
  });
});

describe("MockCandleProvider", () => {
  const p = new MockCandleProvider();
  const from = new Date("2026-10-21T00:00:00Z");
  const to = new Date("2026-10-21T02:00:00Z");

  it("同じ範囲なら毎回同じ値（決定的）", async () => {
    expect(await p.fetch1m("USDJPY", from, to)).toEqual(
      await p.fetch1m("USDJPY", from, to),
    );
  });
  it("範囲をずらしても同じ時刻の足は同じ値", async () => {
    const a = await p.fetch1m("USDJPY", from, to);
    const b = await p.fetch1m(
      "USDJPY",
      new Date("2026-10-21T01:00:00Z"),
      new Date("2026-10-21T03:00:00Z"),
    );
    const t = Date.parse("2026-10-21T01:30:00Z") / 1000;
    expect(a.find((c) => c.time === t)).toEqual(b.find((c) => c.time === t));
  });
  it("1分ごとに [from, to) の足を返し、OHLCが整合している", async () => {
    const out = await p.fetch1m("USDJPY", from, to);
    expect(out).toHaveLength(120);
    for (const c of out) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    }
  });
  it("休場の時間は足を返さない", async () => {
    const out = await p.fetch1m(
      "USDJPY",
      new Date("2026-10-24T00:00:00Z"),
      new Date("2026-10-24T06:00:00Z"),
    );
    expect(out).toEqual([]);
    expect(isMarketOpen(Date.parse("2026-10-24T00:00:00Z") / 1000)).toBe(false);
  });
  it("取得元の名前は mock", () => {
    expect(p.source).toBe("mock");
  });
});
