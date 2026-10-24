import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { candleStore } from "../../src/stores/candleStore";
import { candleService } from "../../src/services/candles/candleService";
import type { Candle } from "../../src/services/candles/CandleProvider";

const PAIR = "USDJPY";
const T0 = Date.parse("2026-09-02T00:00:00Z") / 1000; // 水曜
const T1 = T0 + 6 * 3600;

const candle = (time: number, close: number): Candle => ({
  time,
  open: close - 0.01,
  high: close + 0.02,
  low: close - 0.03,
  close,
});

const closeAt = async (time: number) => {
  const rows = await sql<{ close: number; source: string }[]>`
    SELECT close::float8 AS close, source FROM candles_1m
    WHERE pair = ${PAIR} AND open_time = to_timestamp(${time})
  `;
  return rows[0];
};

describe("candleStore / candleService（実DB）", () => {
  beforeEach(async () => {
    await sql`DELETE FROM candles_1m WHERE open_time >= to_timestamp(${T0}) AND open_time < to_timestamp(${T1})`;
  });
  afterAll(async () => {
    await sql`DELETE FROM candles_1m WHERE open_time >= to_timestamp(${T0}) AND open_time < to_timestamp(${T1})`;
    await sql.end();
  });

  it("古い実データは再同期しても変わらない（recent=false）", async () => {
    await candleStore.upsertMany(PAIR, "dukascopy", [candle(T0, 150)], false);
    await candleStore.upsertMany(PAIR, "dukascopy", [candle(T0, 151)], false);
    expect((await closeAt(T0)).close).toBe(150);
  });

  it("直近の足は同じ取得元なら上書きされる（recent=true）", async () => {
    await candleStore.upsertMany(PAIR, "dukascopy", [candle(T0, 150)], true);
    await candleStore.upsertMany(PAIR, "dukascopy", [candle(T0, 151)], true);
    expect((await closeAt(T0)).close).toBe(151);
  });

  it("実データはモックを置き換えるが、モックは実データを壊さない", async () => {
    await candleStore.upsertMany(PAIR, "mock", [candle(T0, 100)], false);
    await candleStore.upsertMany(PAIR, "dukascopy", [candle(T0, 150)], false);
    expect(await closeAt(T0)).toEqual({ close: 150, source: "dukascopy" });
    await candleStore.upsertMany(PAIR, "mock", [candle(T0, 100)], true);
    expect(await closeAt(T0)).toEqual({ close: 150, source: "dukascopy" });
    await candleStore.upsertMany(PAIR, "mock", [candle(T0, 100)], false);
    expect(await closeAt(T0)).toEqual({ close: 150, source: "dukascopy" });
  });

  it("range: 昇順・[from,to)・上限超過・モック判定", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      candle(T0 + i * 60, 150 + i / 100),
    );
    await candleStore.upsertMany(PAIR, "mock", rows, false);
    const r = await candleStore.range(PAIR, T0 + 60, T0 + 5 * 60, 100);
    expect(r.candles.map((c) => c.time)).toEqual([
      T0 + 60,
      T0 + 120,
      T0 + 180,
      T0 + 240,
    ]);
    expect(r.hasMock).toBe(true);
    expect(r.overLimit).toBe(false);
    expect(r.candles[0].close).toBeCloseTo(150.01, 3);
    const limited = await candleStore.range(PAIR, T0, T0 + 600, 3);
    expect(limited.overLimit).toBe(true);
    expect(limited.candles).toHaveLength(3);
  });

  it("同じ範囲の保存を何度繰り返しても行は増えない（再実行しても安全）", async () => {
    const rows = [candle(T0, 150), candle(T0 + 60, 150.1)];
    for (let i = 0; i < 3; i++)
      await candleStore.upsertMany(PAIR, "dukascopy", rows, i % 2 === 0);
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM candles_1m
      WHERE open_time >= to_timestamp(${T0}) AND open_time < to_timestamp(${T1})`;
    expect(n).toBe(2);
  });

  it("サービス: 保存した1分足を5分足に集計して返す", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      candle(T0 + i * 60, 150 + i / 10),
    );
    await candleStore.upsertMany(PAIR, "dukascopy", rows, false);
    const r = await candleService.get({
      tf: "5m",
      fromSec: T0,
      toSec: T0 + 9 * 60,
      warmup: 0,
    });
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0]).toMatchObject({ time: T0, open: 149.99 });
    expect(r.candles[0].high).toBeCloseTo(150.42, 3);
    expect(r.mock).toBe(false);
    expect(r.hasData).toBe(true);
  });
});
