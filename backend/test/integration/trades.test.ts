import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { userStore } from "../../src/stores/userStore";
import { settingsService } from "../../src/services/settings/settingsService";
import { tagService } from "../../src/services/settings/tagService";
import { ruleService } from "../../src/services/rule/ruleService";
import { tradeService } from "../../src/services/trade/tradeService";
import type { TradeInput } from "../../src/types/trade";

const USER = "it-trades-user";
const OTHER = "it-trades-other";

const input = (o: Partial<TradeInput> = {}): TradeInput => ({
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-10-01T13:10:00Z",
  entryPrice: 150,
  slPrice: null,
  tpPrice: null,
  slReason: null,
  tpReason: null,
  rationaleMemo: null,
  confidence: null,
  exitAt: null,
  exitPrice: null,
  exitMethod: "open",
  insight: null,
  nextRule: null,
  draft: false,
  tagIds: [],
  ruleChecks: [],
  ...o,
});

async function makeUser(id: string) {
  await sql`DELETE FROM users WHERE user_id = ${id}`;
  const now = new Date().toISOString();
  await userStore.create({
    userId: id,
    email: `${id}@example.com`,
    name: id,
    createdAt: now,
    updatedAt: now,
  });
}

describe("トレードAPI（実DB）", () => {
  let rationaleTag = "";
  let manualRule = "";
  let autoRule = "";

  beforeAll(async () => {
    await makeUser(USER);
    await makeUser(OTHER);
    await settingsService.save(USER, { balanceJpy: 750000, maxRiskPct: 1 });
    await settingsService.save(OTHER, { balanceJpy: 750000 });
    rationaleTag = (await tagService.list(USER, "rationale"))[0].id;
    manualRule = (
      await ruleService.create(USER, {
        title: "手動ルール",
        description: "",
        autoKey: null,
        isActive: true,
      })
    ).id;
    autoRule = (
      await ruleService.create(USER, {
        title: "TPまで持つ",
        description: "",
        autoKey: "hold_to_tp",
        isActive: true,
      })
    ).id;
  });
  afterAll(async () => {
    await sql`DELETE FROM users WHERE user_id IN ${sql([USER, OTHER])}`;
    await sql.end();
  });

  it("SL・TP・根拠なしで保存でき、未決済→決済入力で pips/円/R が出る", async () => {
    const created = await tradeService.create(USER, input());
    expect(created.status).toBe("open");
    expect(created.pips).toBeNull();
    expect(created.isUnfilled).toBe(true);

    const closed = await tradeService.update(
      USER,
      created.id,
      input({
        slPrice: 149.8,
        tpPrice: 150.4,
        exitAt: "2026-10-01T13:40:00Z",
        exitPrice: 150.3,
        exitMethod: "manual",
        tagIds: [rationaleTag],
        ruleChecks: [{ ruleId: manualRule, result: "ok" }],
      }),
    );
    expect(closed.status).toBe("closed");
    expect(closed.pips).toBe(30);
    expect(closed.pnlJpy).toBe(3000); // 30pips × 1000円 × 0.1lot
    expect(closed.rMultiple).toBe(1.5);
    expect(closed.plannedRr).toBe(2);
    expect(closed.holdMinutes).toBe(30);
    expect(closed.tags.map((t) => t.id)).toEqual([rationaleTag]);
    expect(closed.isUnfilled).toBe(false);
    // 手動決済でTP未到達 → 自動判定ルールはNG（逸脱）
    expect(closed.ruleResults.find((r) => r.ruleId === autoRule)?.result).toBe(
      "ng",
    );
    expect(closed.deviation).toBe(true);
  });

  it("他人のトレードは見えず、他人のタグ・ルールも指定できない", async () => {
    const mine = await tradeService.create(USER, input());
    await expect(tradeService.get(OTHER, mine.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      tradeService.update(OTHER, mine.id, input()),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(tradeService.delete(OTHER, mine.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      tradeService.create(OTHER, input({ tagIds: [rationaleTag] })),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      tradeService.create(
        OTHER,
        input({ ruleChecks: [{ ruleId: manualRule, result: "ok" }] }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("論理削除と取り消し。削除中は一覧・詳細に出ない", async () => {
    const t = await tradeService.create(
      USER,
      input({ entryAt: "2026-09-01T00:00:00Z" }),
    );
    await tradeService.delete(USER, t.id);
    await expect(tradeService.get(USER, t.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    const list = await tradeService.list(USER, {
      sort: "entry_desc",
      page: 1,
      limit: 100,
      to: "2026-09-02T00:00:00Z",
    });
    expect(list.items.find((i) => i.id === t.id)).toBeUndefined();
    const restored = await tradeService.restore(USER, t.id);
    expect(restored.id).toBe(t.id);
  });

  it("一覧: 勝ち負け・検索・ページング・逸脱のみ", async () => {
    await sql`DELETE FROM trades WHERE user_id = ${USER}`;
    const win = await tradeService.create(
      USER,
      input({
        entryAt: "2026-10-02T00:00:00Z",
        slPrice: 149.8,
        tpPrice: 150.4,
        exitAt: "2026-10-02T00:10:00Z",
        exitPrice: 150.4,
        exitMethod: "tp",
        rationaleMemo: "押し目で入った",
      }),
    );
    const loss = await tradeService.create(
      USER,
      input({
        entryAt: "2026-10-03T00:00:00Z",
        slPrice: 149.8,
        tpPrice: 150.4,
        exitAt: "2026-10-03T00:10:00Z",
        exitPrice: 149.8,
        exitMethod: "sl",
      }),
    );
    const dev = await tradeService.create(
      USER,
      input({
        entryAt: "2026-10-04T00:00:00Z",
        slPrice: 149.8,
        tpPrice: 150.4,
        exitAt: "2026-10-04T00:10:00Z",
        exitPrice: 150.1,
        exitMethod: "manual",
      }),
    );
    const base = { sort: "entry_desc" as const, page: 1, limit: 20 };

    expect(
      (await tradeService.list(USER, base)).items.map((i) => i.id),
    ).toEqual([dev.id, loss.id, win.id]);
    expect(
      (await tradeService.list(USER, { ...base, result: "win" })).items.map(
        (i) => i.id,
      ),
    ).toEqual([dev.id, win.id]);
    expect(
      (await tradeService.list(USER, { ...base, result: "loss" })).items.map(
        (i) => i.id,
      ),
    ).toEqual([loss.id]);
    expect(
      (await tradeService.list(USER, { ...base, q: "押し目" })).items.map(
        (i) => i.id,
      ),
    ).toEqual([win.id]);
    expect((await tradeService.list(USER, { ...base, q: "100%" })).total).toBe(
      0,
    );
    expect(
      (
        await tradeService.list(USER, { ...base, deviationOnly: true })
      ).items.map((i) => i.id),
    ).toEqual([dev.id]);
    const p2 = await tradeService.list(USER, { ...base, limit: 2, page: 2 });
    expect(p2.total).toBe(3);
    expect(p2.items.map((i) => i.id)).toEqual([win.id]);
    const byPnl = await tradeService.list(USER, { ...base, sort: "pnl_asc" });
    expect(byPnl.items[0].id).toBe(loss.id);
  });

  it("未入力キュー: 件数・絞り込み・並べ替え", async () => {
    await sql`DELETE FROM trades WHERE user_id = ${USER}`;
    const filled = await tradeService.create(
      USER,
      input({
        slPrice: 149.8,
        exitAt: "2026-10-02T00:10:00Z",
        exitPrice: 150.1,
        tagIds: [rationaleTag],
      }),
    );
    const noInput = await tradeService.create(
      USER,
      input({
        entryAt: "2026-10-03T00:00:00Z",
        exitAt: "2026-10-03T00:10:00Z",
        exitPrice: 149.9,
      }),
    );
    const open = await tradeService.create(
      USER,
      input({
        entryAt: "2026-10-04T00:00:00Z",
        slPrice: 149.8,
        tagIds: [rationaleTag],
      }),
    );
    const q = {
      filter: "all" as const,
      sort: "entry_desc" as const,
      page: 1,
      limit: 20,
    };

    const all = await tradeService.queue(USER, q);
    expect(all.items.map((i) => i.id)).toEqual([open.id, noInput.id]);
    expect(all).toMatchObject({
      pendingCount: 2,
      totalCount: 3,
      filledCount: 1,
    });
    expect(all.items.every((i) => i.isUnfilled)).toBe(true);

    expect(
      (await tradeService.queue(USER, { ...q, filter: "open" })).items.map(
        (i) => i.id,
      ),
    ).toEqual([open.id]);
    expect(
      (await tradeService.queue(USER, { ...q, filter: "loss" })).items.map(
        (i) => i.id,
      ),
    ).toEqual([noInput.id]);
    expect(
      (
        await tradeService.queue(USER, { ...q, filter: "no_rationale" })
      ).items.map((i) => i.id),
    ).toEqual([noInput.id]);
    expect(
      (await tradeService.queue(USER, { ...q, filter: "sl_tp" })).total,
    ).toBe(3);
    expect(
      (await tradeService.queue(USER, { ...q, sort: "entry_asc" })).items[0].id,
    ).toBe(noInput.id);
    expect(filled.isUnfilled).toBe(false);
    // 画面側の判定（TS）とキューのSQLが一致していること
    const pendingByTs = (
      await tradeService.list(USER, { sort: "entry_desc", page: 1, limit: 100 })
    ).items.filter((i) => i.isUnfilled).length;
    expect(pendingByTs).toBe(all.pendingCount);
  });

  it("CSV由来の円損益は、価格を変えない編集では保たれる", async () => {
    const t = await tradeService.create(
      USER,
      input({ exitAt: "2026-10-05T00:10:00Z", exitPrice: 150.1 }),
    );
    await sql`UPDATE trades SET source = 'rakuten_csv', pnl_jpy = 950 WHERE id = ${t.id}`;
    const kept = await tradeService.update(
      USER,
      t.id,
      input({
        exitAt: "2026-10-05T00:10:00Z",
        exitPrice: 150.1,
        rationaleMemo: "書き足し",
      }),
    );
    expect(kept.pnlJpy).toBe(950);
    const changed = await tradeService.update(
      USER,
      t.id,
      input({ exitAt: "2026-10-05T00:10:00Z", exitPrice: 150.2 }),
    );
    expect(changed.pnlJpy).toBe(2000);
  });

  it("source_key が同じトレードは作れない（重複判定の土台）", async () => {
    await sql`
      INSERT INTO trades (user_id, source, source_key, pair, side, lots, entry_at, entry_price)
      VALUES (${USER}, 'rakuten_csv', 'rakuten:1:2', 'USDJPY', 'buy', 0.1, NOW(), 150)
    `;
    await expect(
      sql`INSERT INTO trades (user_id, source, source_key, pair, side, lots, entry_at, entry_price)
          VALUES (${USER}, 'rakuten_csv', 'rakuten:1:2', 'USDJPY', 'buy', 0.1, NOW(), 150)`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("ルールを無効化しても過去の手動判定は残る", async () => {
    const t = await tradeService.create(
      USER,
      input({ ruleChecks: [{ ruleId: manualRule, result: "ng" }] }),
    );
    await ruleService.update(USER, manualRule, { isActive: false });
    const v = await tradeService.get(USER, t.id);
    expect(v.ruleResults.find((r) => r.ruleId === manualRule)).toMatchObject({
      result: "ng",
      isActive: false,
    });
    expect(v.deviation).toBe(false);
    await ruleService.update(USER, manualRule, { isActive: true });
  });
});
