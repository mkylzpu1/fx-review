import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { userStore } from "../../src/stores/userStore";
import { settingsService } from "../../src/services/settings/settingsService";
import { tagService } from "../../src/services/settings/tagService";
import { pairService } from "../../src/services/settings/pairService";

const USER = "it-settings-user";

describe("設定API（実DB）", () => {
  beforeAll(async () => {
    await sql`DELETE FROM users WHERE user_id = ${USER}`;
    const now = new Date().toISOString();
    await userStore.create({
      userId: USER,
      email: "it@example.com",
      name: "IT",
      createdAt: now,
      updatedAt: now,
    });
  });
  afterAll(async () => {
    await sql`DELETE FROM users WHERE user_id = ${USER}`;
    await sql.end();
  });

  it("未作成は404 → 作成で USDJPY と既定タグが入る", async () => {
    await expect(settingsService.get(USER)).rejects.toMatchObject({
      statusCode: 404,
    });
    const s = await settingsService.save(USER, { balanceJpy: 750000 });
    expect(s.balanceJpy).toBe(750000);
    expect((await pairService.list(USER)).map((p) => p.symbol)).toEqual([
      "USDJPY",
    ]);
    expect((await tagService.list(USER)).length).toBe(14);
  });

  it("EMA設定は配列のまま保存・取得できる（JSON二重エンコードの回帰防止）", async () => {
    const s = await settingsService.save(USER, {
      emaSettings: [{ period: 20, visible: true }],
    });
    expect(s.emaSettings).toEqual([{ period: 20, visible: true }]);
  });

  it("タグは論理削除され、同名の再追加で復活する", async () => {
    const t = await tagService.create(USER, "emotion", "眠い");
    await expect(
      tagService.create(USER, "emotion", "眠い"),
    ).rejects.toMatchObject({ statusCode: 409 });
    await tagService.delete(USER, t.id);
    expect(
      (await tagService.list(USER, "emotion")).some((x) => x.id === t.id),
    ).toBe(false);
    expect((await tagService.create(USER, "emotion", "眠い")).id).toBe(t.id);
  });
});
