import { describe, it, expect } from "vitest";
import { resample, sessionStart } from "../../../src/services/candles/resample";
import type { Candle } from "../../../src/services/candles/CandleProvider";

const utc = (s: string) => Date.parse(s) / 1000;
const c = (t: string, o: number, h: number, l: number, cl: number): Candle => ({
  time: utc(t),
  open: o,
  high: h,
  low: l,
  close: cl,
});

describe("resample 5m/15m/1h（UTC区切り）", () => {
  const m1 = [
    c("2026-10-01T00:00:00Z", 150.0, 150.1, 149.9, 150.05),
    c("2026-10-01T00:01:00Z", 150.05, 150.3, 150.0, 150.2),
    c("2026-10-01T00:04:00Z", 150.2, 150.25, 150.1, 150.15),
    c("2026-10-01T00:05:00Z", 150.15, 150.2, 150.0, 150.1),
  ];
  it("始値は先頭、終値は末尾、高値は最大、安値は最小", () => {
    const r = resample(m1, "5m");
    expect(r).toEqual([
      {
        time: utc("2026-10-01T00:00:00Z"),
        open: 150.0,
        high: 150.3,
        low: 149.9,
        close: 150.15,
      },
      {
        time: utc("2026-10-01T00:05:00Z"),
        open: 150.15,
        high: 150.2,
        low: 150.0,
        close: 150.1,
      },
    ]);
  });
  it("欠けた分は補完しない（00:02, 00:03 が無くても1本にまとまる）", () => {
    expect(resample(m1, "5m")[0].close).toBe(150.15);
  });
  it("1h と 15m の区切り", () => {
    expect(resample(m1, "1h")).toHaveLength(1);
    expect(resample(m1, "15m")[0].time).toBe(utc("2026-10-01T00:00:00Z"));
  });
  it("1m はそのまま（コピーを返す）", () => {
    const r = resample(m1, "1m");
    expect(r).toEqual(m1);
    expect(r[0]).not.toBe(m1[0]);
  });
  it("空なら空", () => {
    expect(resample([], "1h")).toEqual([]);
  });
});

describe("日足・4時間足はニューヨーク17:00区切り（夏時間に追従）", () => {
  it("夏時間（EDT, UTC-4）: 21:00 UTC が日の始まり", () => {
    expect(sessionStart(utc("2026-07-01T20:59:00Z"))).toBe(
      utc("2026-06-30T21:00:00Z"),
    );
    expect(sessionStart(utc("2026-07-01T21:00:00Z"))).toBe(
      utc("2026-07-01T21:00:00Z"),
    );
  });
  it("冬時間（EST, UTC-5）: 22:00 UTC が日の始まり", () => {
    expect(sessionStart(utc("2026-12-01T21:59:00Z"))).toBe(
      utc("2026-11-30T22:00:00Z"),
    );
    expect(sessionStart(utc("2026-12-01T22:00:00Z"))).toBe(
      utc("2026-12-01T22:00:00Z"),
    );
  });
  it("1d: 区切りの前後で別の足になる（夏）", () => {
    const r = resample(
      [
        c("2026-07-01T20:59:00Z", 150, 150.5, 149.5, 150.2),
        c("2026-07-01T21:00:00Z", 150.2, 150.4, 150.0, 150.3),
        c("2026-07-02T10:00:00Z", 150.3, 151.0, 150.1, 150.9),
      ],
      "1d",
    );
    expect(r.map((x) => x.time)).toEqual([
      utc("2026-06-30T21:00:00Z"),
      utc("2026-07-01T21:00:00Z"),
    ]);
    expect(r[1]).toMatchObject({
      open: 150.2,
      high: 151.0,
      low: 150.0,
      close: 150.9,
    });
  });
  it("4h: 夏は 21,01,05,09,13,17 UTC 始まり", () => {
    const r = resample(
      [
        c("2026-07-01T21:00:00Z", 1, 1, 1, 1),
        c("2026-07-02T00:59:00Z", 1, 1, 1, 1),
        c("2026-07-02T01:00:00Z", 1, 1, 1, 1),
        c("2026-07-02T13:30:00Z", 1, 1, 1, 1),
      ],
      "4h",
    );
    expect(r.map((x) => x.time)).toEqual([
      utc("2026-07-01T21:00:00Z"),
      utc("2026-07-02T01:00:00Z"),
      utc("2026-07-02T13:00:00Z"),
    ]);
  });
  it("4h: 冬は 22,02,06,10,14,18 UTC 始まり", () => {
    const r = resample(
      [
        c("2026-12-01T22:30:00Z", 1, 1, 1, 1),
        c("2026-12-02T02:00:00Z", 1, 1, 1, 1),
      ],
      "4h",
    );
    expect(r.map((x) => x.time)).toEqual([
      utc("2026-12-01T22:00:00Z"),
      utc("2026-12-02T02:00:00Z"),
    ]);
  });
  it("夏時間の切り替え（2026-11-01 02:00 現地）をまたいでも17:00区切りを保つ", () => {
    // 11/1(日) 17:00 EST = 22:00 UTC。それ以前（11/1 12:00 UTC）の区切りは 10/31(土) 17:00 EDT = 21:00 UTC
    expect(sessionStart(utc("2026-11-01T22:00:00Z"))).toBe(
      utc("2026-11-01T22:00:00Z"),
    );
    expect(sessionStart(utc("2026-11-01T12:00:00Z"))).toBe(
      utc("2026-10-31T21:00:00Z"),
    );
  });
});
