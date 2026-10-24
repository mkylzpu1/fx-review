import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Candle } from "../../../src/services/candles/CandleProvider";

const range = vi.fn();
vi.mock("../../../src/stores/candleStore", () => ({
  candleStore: { range: (...a: unknown[]) => range(...a) },
}));

import { candleService } from "../../../src/services/candles/candleService";
import { MockCandleProvider } from "../../../src/services/candles/MockCandleProvider";

const sec = (iso: string) => Date.parse(iso) / 1000;

/** 範囲に合わせてモックの1分足を返すストアの代わり */
function fakeStore(opts: { hasMock?: boolean; overLimit?: boolean } = {}) {
  const provider = new MockCandleProvider();
  range.mockImplementation(async (_pair: string, from: number, to: number) => {
    const candles: Candle[] = await provider.fetch1m(
      "USDJPY",
      new Date(from * 1000),
      new Date(to * 1000),
    );
    return {
      candles,
      hasMock: opts.hasMock ?? false,
      overLimit: opts.overLimit ?? false,
    };
  });
}

describe("candleService.get", () => {
  beforeEach(() => {
    range.mockReset();
    fakeStore();
  });

  it("1時間足に集計して時刻の昇順で返す（to を含む足まで）", async () => {
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-21T01:30:00Z"),
      toSec: sec("2026-10-21T04:10:00Z"),
      warmup: 0,
    });
    expect(r.candles.map((c) => c.time)).toEqual([
      sec("2026-10-21T01:00:00Z"),
      sec("2026-10-21T02:00:00Z"),
      sec("2026-10-21T03:00:00Z"),
      sec("2026-10-21T04:00:00Z"),
    ]);
    expect(r.warmupCount).toBe(0);
    expect(r.hasData).toBe(true);
    expect(r.mock).toBe(false);
  });

  it("from の足は途中からでも1本まるごと（区切りに合わせる）", async () => {
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-21T01:30:00Z"),
      toSec: sec("2026-10-21T01:45:00Z"),
      warmup: 0,
    });
    expect(r.candles).toHaveLength(1);
    // 01:00 の足は 60 本の1分足から作られる
    const [, from, to] = range.mock.calls[0];
    expect(from).toBe(sec("2026-10-21T01:00:00Z"));
    expect(to).toBe(sec("2026-10-21T02:00:00Z"));
  });

  it("warmup 本数ぶん表示範囲より前の足を先頭に付け、warmupCount で区別できる", async () => {
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-21T12:00:00Z"),
      toSec: sec("2026-10-21T14:00:00Z"),
      warmup: 10,
    });
    expect(r.warmupCount).toBe(10);
    expect(r.candles).toHaveLength(13);
    expect(r.candles[10].time).toBe(sec("2026-10-21T12:00:00Z"));
    expect(r.candles[9].time).toBe(sec("2026-10-21T11:00:00Z"));
  });

  it("週末をまたいでも warmup 本数がそろう（休場の分は足がないので時間幅を広げて読む）", async () => {
    // 月曜 00:00 UTC の前に週末がある
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-26T00:00:00Z"),
      toSec: sec("2026-10-26T02:00:00Z"),
      warmup: 30,
    });
    expect(r.warmupCount).toBe(30);
    // 先頭は金曜、末尾は日曜夜の再開後（土曜をはさんで30本）
    expect(r.candles[0].time).toBeLessThan(sec("2026-10-24T00:00:00Z"));
    expect(r.candles[29].time).toBeGreaterThan(sec("2026-10-25T00:00:00Z"));
  });

  it("データが足りないときは取れた分だけ返す", async () => {
    range.mockResolvedValue({
      candles: [],
      hasMock: false,
      overLimit: false,
    });
    const r = await candleService.get({
      tf: "5m",
      fromSec: sec("2026-10-21T00:00:00Z"),
      toSec: sec("2026-10-21T01:00:00Z"),
      warmup: 50,
    });
    expect(r).toEqual({
      tf: "5m",
      candles: [],
      warmupCount: 0,
      hasData: false,
      mock: false,
    });
  });

  it("休場の時間（土曜）だけを指定すると hasData=false", async () => {
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-24T02:00:00Z"),
      toSec: sec("2026-10-24T08:00:00Z"),
      warmup: 0,
    });
    expect(r.hasData).toBe(false);
    expect(r.candles).toEqual([]);
  });

  it("ウォームアップだけにデータがあるときは hasData=false（表示範囲が空）", async () => {
    const r = await candleService.get({
      tf: "1h",
      fromSec: sec("2026-10-24T02:00:00Z"),
      toSec: sec("2026-10-24T08:00:00Z"),
      warmup: 5,
    });
    expect(r.warmupCount).toBe(5);
    expect(r.hasData).toBe(false);
  });

  it("モックの足が含まれていれば mock=true", async () => {
    fakeStore({ hasMock: true });
    const r = await candleService.get({
      tf: "15m",
      fromSec: sec("2026-10-21T00:00:00Z"),
      toSec: sec("2026-10-21T01:00:00Z"),
      warmup: 0,
    });
    expect(r.mock).toBe(true);
  });

  it("4時間足はニューヨーク17:00（夏時間は 21:00 UTC）区切り", async () => {
    const r = await candleService.get({
      tf: "4h",
      fromSec: sec("2026-10-21T10:00:00Z"),
      toSec: sec("2026-10-21T10:01:00Z"),
      warmup: 0,
    });
    expect(r.candles[0].time).toBe(sec("2026-10-21T09:00:00Z"));
  });

  it("toがfrom以前、warmupが範囲外、日時が不正なら ValidationError", async () => {
    const base = {
      tf: "1h" as const,
      fromSec: sec("2026-10-21T00:00:00Z"),
      toSec: sec("2026-10-21T01:00:00Z"),
      warmup: 0,
    };
    await expect(
      candleService.get({ ...base, toSec: base.fromSec }),
    ).rejects.toThrow("to は from より後");
    await expect(candleService.get({ ...base, warmup: 2001 })).rejects.toThrow(
      "warmup",
    );
    await expect(
      candleService.get({ ...base, fromSec: Number.NaN }),
    ).rejects.toThrow("不正");
  });

  it("表示範囲の足が多すぎる、または1分足の行数が上限を超えるときは断る", async () => {
    await expect(
      candleService.get({
        tf: "1m",
        fromSec: sec("2026-10-01T00:00:00Z"),
        toSec: sec("2026-10-10T00:00:00Z"),
        warmup: 0,
      }),
    ).rejects.toThrow("範囲が広すぎます");
    fakeStore({ overLimit: true });
    await expect(
      candleService.get({
        tf: "1h",
        fromSec: sec("2026-10-21T00:00:00Z"),
        toSec: sec("2026-10-21T01:00:00Z"),
        warmup: 0,
      }),
    ).rejects.toThrow("範囲が広すぎます");
  });
});
