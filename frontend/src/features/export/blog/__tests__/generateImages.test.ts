import { describe, expect, it, vi } from "vitest";
import type { CandlesResponse } from "@/features/trades/types";
import { buildDayBundles } from "../buildDayJson";
import {
  countImages,
  generateImages,
  isAbort,
  type ImageDeps,
} from "../generateImages";
import { groupByDay } from "../groupByDay";
import { makeTrade } from "./fixtures";

const ENTRY = "2026-10-29T01:00:00.000Z";
const entrySec = Date.parse(ENTRY) / 1000;

/** エントリーの足を含む、1時間足相当の足を並べる（1分足でも同じ時刻で足りる） */
const candlesAround = (stepSec: number, hasData = true): CandlesResponse => ({
  tf: "1h",
  hasData,
  mock: false,
  warmupCount: 0,
  candles: hasData
    ? Array.from({ length: 5 }, (_, i) => {
        const time = entrySec - stepSec + i * stepSec;
        return { time, open: 150, high: 150.1, low: 149.9, close: 150.05 };
      })
    : [],
});

const settings = {
  before: 60,
  after: 40,
  emas: [{ period: 20, visible: true }],
};
const groupsOf = (trades: ReturnType<typeof makeTrade>[]) =>
  groupByDay(trades, {
    timeZone: "Asia/Tokyo",
    from: "2026-10-29",
    to: "2026-10-29",
    includeOpen: false,
  });

const png = new Uint8Array([1, 2, 3]);

describe("generateImages", () => {
  it("1トレード3枚。パスは契約どおりで、進捗が n/m で進む", async () => {
    const t = makeTrade({ entryAt: ENTRY });
    const deps: ImageDeps = {
      fetchCandles: vi.fn(async () => candlesAround(60)),
      render: vi.fn(async () => png),
    };
    const progress: [number, number][] = [];
    const r = await generateImages({
      groups: groupsOf([t]),
      settings,
      pipSizeOf: () => 0.01,
      onProgress: (d, n) => progress.push([d, n]),
      deps,
    });
    expect(progress[0]).toEqual([0, 3]);
    expect(progress.at(-1)).toEqual([3, 3]);
    expect([...r.images.get("2026-10-29")!.keys()].sort()).toEqual([
      "charts/01_USDJPY_15m.png",
      "charts/01_USDJPY_1h.png",
      "charts/01_USDJPY_1m.png",
    ]);
    expect(deps.render).toHaveBeenCalledTimes(3);
  });

  it("ローソク足が無いときは画像を作らず candles_missing。zip全体は失敗にしない", async () => {
    const a = makeTrade({ entryAt: ENTRY });
    const deps: ImageDeps = {
      fetchCandles: vi.fn(async () => candlesAround(60, false)),
      render: vi.fn(async () => png),
    };
    const groups = groupsOf([a]);
    const r = await generateImages({
      groups,
      settings,
      pipSizeOf: () => 0.01,
      deps,
    });
    expect(deps.render).not.toHaveBeenCalled();
    expect(r.images.get("2026-10-29")!.size).toBe(0);
    const built = buildDayBundles([a], {
      timeZone: "Asia/Tokyo",
      from: "2026-10-29",
      to: "2026-10-29",
      includeOpen: false,
      charts: r.charts,
    });
    expect(built.days[0].trades[0].charts).toEqual({
      "1m": null,
      "15m": null,
      "1h": null,
    });
    expect(
      built.warnings.filter((w) => w.code === "candles_missing"),
    ).toHaveLength(3);
  });

  it("エントリーの足が無い（足が途切れている）ときも candles_missing", async () => {
    const t = makeTrade({ entryAt: ENTRY });
    const deps: ImageDeps = {
      // エントリーより前の足だけ
      fetchCandles: vi.fn(async () => ({
        ...candlesAround(60),
        candles: [
          { time: entrySec - 7200, open: 1, high: 1, low: 1, close: 1 },
        ],
      })),
      render: vi.fn(async () => png),
    };
    const r = await generateImages({
      groups: groupsOf([t]),
      settings,
      pipSizeOf: () => 0.01,
      deps,
    });
    expect(deps.render).not.toHaveBeenCalled();
    expect(r.charts.get(t.id)?.["1m"]).toMatchObject({
      reason: "candles_missing",
    });
  });

  it("取得や描画の失敗は image_failed にして、他の画像は続ける", async () => {
    const t = makeTrade({ entryAt: ENTRY });
    let n = 0;
    const deps: ImageDeps = {
      fetchCandles: vi.fn(async () => candlesAround(60)),
      render: vi.fn(async () => {
        n += 1;
        if (n === 1) throw new Error("boom");
        return png;
      }),
    };
    const r = await generateImages({
      groups: groupsOf([t]),
      settings,
      pipSizeOf: () => 0.01,
      deps,
    });
    expect(r.charts.get(t.id)?.["1m"]).toMatchObject({
      reason: "image_failed",
      detail: "boom",
    });
    expect(r.images.get("2026-10-29")!.size).toBe(2);
  });

  it("キャンセルすると AbortError で止まり、それ以降は描かない", async () => {
    const t = makeTrade({ entryAt: ENTRY });
    const ac = new AbortController();
    const deps: ImageDeps = {
      fetchCandles: vi.fn(async () => candlesAround(60)),
      render: vi.fn(async () => {
        ac.abort();
        return png;
      }),
    };
    await expect(
      generateImages({
        groups: groupsOf([t]),
        settings,
        pipSizeOf: () => 0.01,
        signal: ac.signal,
        deps,
      }),
    ).rejects.toSatisfy(isAbort);
    expect(deps.render).toHaveBeenCalledTimes(1);
  });

  it("枚数は 件数×3", () => {
    expect(
      countImages(groupsOf([makeTrade({ entryAt: ENTRY }), makeTrade()])),
    ).toBe(6);
  });
});
