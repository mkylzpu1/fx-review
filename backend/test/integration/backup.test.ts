import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { userStore } from "../../src/stores/userStore";
import { settingsService } from "../../src/services/settings/settingsService";
import { tagService } from "../../src/services/settings/tagService";
import { ruleService } from "../../src/services/rule/ruleService";
import { tradeService } from "../../src/services/trade/tradeService";
import {
  backupService,
  BackupFileSchema,
} from "../../src/services/backup/backupService";
import type { TradeInput } from "../../src/types/trade";

const USER = "it-backup-user";
const OTHER = "it-backup-other";

const input = (o: Partial<TradeInput> = {}): TradeInput => ({
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-10-01T13:10:00Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.4,
  slReason: null,
  tpReason: null,
  rationaleMemo: "メモ",
  confidence: 3,
  exitAt: "2026-10-01T13:40:00Z",
  exitPrice: 150.2,
  exitMethod: "manual",
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

const count = async (table: string, user: string) =>
  (
    await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${sql(table)} WHERE user_id = ${user}`
  )[0].n;

describe("バックアップ・復元・全削除（実DB）", () => {
  let tagId = "";
  let ruleId = "";

  beforeAll(async () => {
    await makeUser(USER);
    await makeUser(OTHER);
    await settingsService.save(USER, { balanceJpy: 750000 });
    await settingsService.save(OTHER, { balanceJpy: 100000 });
    tagId = (await tagService.list(USER, "rationale"))[0].id;
    ruleId = (
      await ruleService.create(USER, {
        title: "手動ルール",
        description: "",
        autoKey: null,
        isActive: true,
      })
    ).id;
    await tradeService.create(
      USER,
      input({ tagIds: [tagId], ruleChecks: [{ ruleId, result: "ok" }] }),
    );
    await tradeService.create(OTHER, input());
  });
  afterAll(async () => {
    await sql`DELETE FROM users WHERE user_id IN (${USER}, ${OTHER})`;
    await sql.end();
  });

  it("バックアップ → 全削除 → 復元で、トレード・タグ・ルール判定が元に戻る", async () => {
    const file = await backupService.export(USER);
    expect(file.data.trades).toHaveLength(1);
    expect(file.data.trade_tags).toHaveLength(1);
    expect(file.data.trade_rule_checks).toHaveLength(1);
    // 他のユーザーのデータは入らない
    expect(file.data.account_settings).toHaveLength(1);

    await backupService.deleteAll(USER);
    expect(await count("trades", USER)).toBe(0);
    expect(await count("rules", USER)).toBe(0);
    expect(await count("account_settings", USER)).toBe(0);
    // 他のユーザーは無傷。ユーザー自体も残る
    expect(await count("trades", OTHER)).toBe(1);
    expect(await userStore.get(USER)).not.toBeNull();

    const parsed = BackupFileSchema.parse(JSON.parse(JSON.stringify(file)));
    expect(await backupService.restore(USER, parsed)).toEqual({ trades: 1 });
    expect(await count("trades", USER)).toBe(1);
    expect(await count("rules", USER)).toBe(1);
    const list = await tradeService.listAll(USER, {});
    expect(list[0].pips).toBeCloseTo(20, 5);
    expect(list[0].tags.map((t) => t.id)).toContain(tagId);
    expect(list[0].ruleResults.find((r) => r.ruleId === ruleId)?.result).toBe(
      "ok",
    );
    expect((await settingsService.get(USER)).balanceJpy).toBe(750000);
  });

  it("バックアップ内の user_id が他人でも、本人のものとして復元される", async () => {
    const file = await backupService.export(USER);
    const tampered = JSON.parse(JSON.stringify(file));
    for (const t of Object.keys(tampered.data)) {
      for (const r of tampered.data[t]) if ("user_id" in r) r.user_id = OTHER;
    }
    await backupService.restore(USER, BackupFileSchema.parse(tampered));
    expect(await count("trades", USER)).toBe(1);
    expect(await count("trades", OTHER)).toBe(1); // 増えない
  });

  it("壊れたバックアップは復元に失敗し、いまのデータは残る", async () => {
    const file = JSON.parse(JSON.stringify(await backupService.export(USER)));
    file.data.trades[0].entry_price = "not-a-number";
    await expect(
      backupService.restore(USER, BackupFileSchema.parse(file)),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await count("trades", USER)).toBe(1);
    expect(await count("rules", USER)).toBe(1);
  });

  it("他人のトレードのIDをタグ付けに指定しても拒否される", async () => {
    const file = JSON.parse(JSON.stringify(await backupService.export(USER)));
    const otherTrade = (
      await sql<
        { id: string }[]
      >`SELECT id FROM trades WHERE user_id = ${OTHER}`
    )[0].id;
    file.data.trade_tags.push({ trade_id: otherTrade, tag_id: tagId });
    await expect(
      backupService.restore(USER, BackupFileSchema.parse(file)),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("ローソク足（共有データ）は全削除で消えない", async () => {
    await sql`INSERT INTO candles_1m (pair, open_time, open, high, low, close)
      VALUES ('USDJPY', '2026-10-01T00:00:00Z', 150, 150.1, 149.9, 150)
      ON CONFLICT DO NOTHING`;
    await backupService.deleteAll(USER);
    const n = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM candles_1m WHERE open_time = '2026-10-01T00:00:00Z'`;
    expect(n[0].n).toBe(1);
  });
});
