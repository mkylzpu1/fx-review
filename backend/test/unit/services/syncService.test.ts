import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Candle } from "../../../src/services/candles/CandleProvider";

const upsertMany = vi.fn();
vi.mock("../../../src/stores/candleStore", () => ({
  candleStore: { upsertMany: (...a: unknown[]) => upsertMany(...a) },
}));

import {
  splitRange,
  splitRecent,
  syncCandles,
} from "../../../src/services/candles/syncService";
import { parseSyncArgs } from "../../../scripts/syncArgs";

const sec = (iso: string) => Date.parse(iso) / 1000;
const candle = (iso: string): Candle => ({
  time: sec(iso),
  open: 150,
  high: 150.1,
  low: 149.9,
  close: 150.05,
});

describe("splitRange", () => {
  it("日数ごとに分け、最後は to で切る", () => {
    const r = splitRange(
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-16T00:00:00Z"),
      7,
    );
    expect(r.map((x) => [x.from.toISOString(), x.to.toISOString()])).toEqual([
      ["2026-10-01T00:00:00.000Z", "2026-10-08T00:00:00.000Z"],
      ["2026-10-08T00:00:00.000Z", "2026-10-15T00:00:00.000Z"],
      ["2026-10-15T00:00:00.000Z", "2026-10-16T00:00:00.000Z"],
    ]);
  });
});

describe("splitRecent（直近48時間の境界）", () => {
  const now = new Date("2026-10-24T00:00:00Z");
  it("ちょうど48時間前は直近、1分古いと古い扱い", () => {
    const { recent, old } = splitRecent(
      [candle("2026-10-22T00:00:00Z"), candle("2026-10-21T23:59:00Z")],
      now,
    );
    expect(recent.map((c) => c.time)).toEqual([sec("2026-10-22T00:00:00Z")]);
    expect(old.map((c) => c.time)).toEqual([sec("2026-10-21T23:59:00Z")]);
  });
});

describe("syncCandles", () => {
  beforeEach(() => upsertMany.mockReset());

  it("古い足は上書きなし(false)、直近は上書きあり(true)で保存する", async () => {
    const provider = {
      source: "dukascopy",
      fetch1m: vi.fn(async () => [
        candle("2026-10-10T00:00:00Z"),
        candle("2026-10-23T12:00:00Z"),
      ]),
    };
    const res = await syncCandles(
      provider,
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-08T00:00:00Z"),
      { now: new Date("2026-10-24T00:00:00Z") },
    );
    expect(res).toEqual({ fetched: 2, chunks: 1 });
    expect(upsertMany).toHaveBeenCalledTimes(2);
    expect(upsertMany.mock.calls[0][3]).toBe(false);
    expect(upsertMany.mock.calls[1][3]).toBe(true);
    expect(upsertMany.mock.calls[0][1]).toBe("dukascopy");
  });

  it("足が0本でも失敗せず、保存を呼ばない", async () => {
    const provider = { source: "mock", fetch1m: vi.fn(async () => []) };
    const res = await syncCandles(
      provider,
      new Date("2026-10-24T00:00:00Z"),
      new Date("2026-10-25T00:00:00Z"),
    );
    expect(res.fetched).toBe(0);
    expect(upsertMany).not.toHaveBeenCalled();
  });

  it("取得に失敗したら投げる（途中までの保存は残る）", async () => {
    const provider = {
      source: "dukascopy",
      fetch1m: vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    };
    await expect(
      syncCandles(
        provider,
        new Date("2026-10-01T00:00:00Z"),
        new Date("2026-10-02T00:00:00Z"),
      ),
    ).rejects.toThrow("fetch failed");
  });
});

describe("parseSyncArgs", () => {
  it("to の日の終わり（翌日0時UTC）までを範囲にする", () => {
    const a = parseSyncArgs(["--from", "2026-10-01", "--to", "2026-10-23"]);
    expect(a.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(a.to.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(a.provider).toBe("dukascopy");
  });
  it("日付の形式・順序・providerの誤りを弾く", () => {
    expect(() => parseSyncArgs(["--to", "2026-10-23"])).toThrow("--from");
    expect(() =>
      parseSyncArgs(["--from", "2026/10/01", "--to", "2026-10-23"]),
    ).toThrow("YYYY-MM-DD");
    expect(() =>
      parseSyncArgs(["--from", "2026-10-23", "--to", "2026-10-01"]),
    ).toThrow("以降");
    expect(() =>
      parseSyncArgs([
        "--from",
        "2026-10-01",
        "--to",
        "2026-10-02",
        "--provider",
        "x",
      ]),
    ).toThrow("--provider");
  });
});
