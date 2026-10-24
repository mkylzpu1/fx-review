import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { userStore } from "../../src/stores/userStore";
import { candleStore } from "../../src/stores/candleStore";
import { settingsService } from "../../src/services/settings/settingsService";
import { tradeService } from "../../src/services/trade/tradeService";
import { excursionService } from "../../src/services/trade/excursionService";
import type { Candle } from "../../src/services/candles/CandleProvider";
import type { TradeInput } from "../../src/types/trade";

const USER = "it-excursion-user";
const sec = (iso: string) => Date.parse(iso) / 1000;
const bar = (iso: string, h: number, l: number): Candle => ({
  time: sec(iso),
  open: 150,
  high: h,
  low: l,
  close: 150,
});

const input = (o: Partial<TradeInput> = {}): TradeInput => ({
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-09-02T00:00:30Z",
  entryPrice: 150,
  slPrice: null,
  tpPrice: null,
  slReason: null,
  tpReason: null,
  rationaleMemo: null,
  confidence: null,
  exitAt: "2026-09-02T00:03:10Z",
  exitPrice: 150.2,
  exitMethod: "manual",
  insight: null,
  nextRule: null,
  draft: false,
  tagIds: [],
  ruleChecks: [],
  ...o,
});

const clean = () =>
  sql`DELETE FROM candles_1m WHERE open_time >= '2026-09-02T00:00:00Z' AND open_time < '2026-09-02T02:00:00Z'`;

describe("MFE/MAE（実DB）", () => {
  beforeAll(async () => {
    await sql`DELETE FROM users WHERE user_id = ${USER}`;
    const now = new Date().toISOString();
    await userStore.create({
      userId: USER,
      email: "ex@example.com",
      name: "ex",
      createdAt: now,
      updatedAt: now,
    });
    await settingsService.save(USER, { balanceJpy: 750000 });
    await clean();
  });
  afterAll(async () => {
    await sql`DELETE FROM users WHERE user_id = ${USER}`;
    await clean();
    await sql.end();
  });

  it("足が無いうちは null。保存しても失敗しない", async () => {
    const t = await tradeService.create(USER, input());
    expect(t.mfePips).toBeNull();
    expect(t.maePips).toBeNull();
    expect(t.afterMaxPips).toBeNull();
  });

  it("足を入れたあとで保存すると、保有中の最大/最小と決済後の最大到達が入る", async () => {
    await candleStore.upsertMany(
      "USDJPY",
      "dukascopy",
      [
        bar("2026-09-02T00:00:00Z", 150.05, 149.9),
        bar("2026-09-02T00:01:00Z", 150.3, 150.0),
        bar("2026-09-02T00:02:00Z", 150.28, 149.95),
        bar("2026-09-02T00:03:00Z", 150.22, 150.05),
        bar("2026-09-02T00:04:00Z", 150.5, 150.18),
      ],
      false,
    );
    const t = await tradeService.create(USER, input());
    expect(t.mfePips).toBe(30);
    expect(t.maePips).toBe(-10);
    expect(t.afterMaxPips).toBe(30);
  });

  it("決済価格を直して更新すると、値も計算し直される。未決済に戻すと null", async () => {
    const t = await tradeService.create(USER, input());
    const moved = await tradeService.update(
      USER,
      t.id,
      input({ exitPrice: 150.4 }),
    );
    expect(moved.afterMaxPips).toBe(10); // 150.50 - 150.40
    const reopened = await tradeService.update(
      USER,
      t.id,
      input({ exitAt: null, exitPrice: null, exitMethod: "open" }),
    );
    expect(reopened.mfePips).toBeNull();
    expect(reopened.afterMaxPips).toBeNull();
  });

  it("refreshRange: 期間内の決済済みトレードを計算し直す", async () => {
    await sql`UPDATE trades SET mfe_pips = NULL, mae_pips = NULL, after_max_pips = NULL WHERE user_id = ${USER}`;
    const r = await excursionService.refreshRange(
      new Date("2026-09-02T00:00:00Z"),
      new Date("2026-09-03T00:00:00Z"),
    );
    expect(r.total).toBeGreaterThanOrEqual(2);
    expect(r.withData).toBeGreaterThanOrEqual(2);
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM trades
      WHERE user_id = ${USER} AND status = 'closed' AND mfe_pips IS NOT NULL`;
    expect(n).toBeGreaterThanOrEqual(2);
  });
});
