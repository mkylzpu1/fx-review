import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "../../src/lib/db";
import { userStore } from "../../src/stores/userStore";
import { settingsService } from "../../src/services/settings/settingsService";
import { importService } from "../../src/services/import/importService";
import { tradeService } from "../../src/services/trade/tradeService";
import {
  buildSample,
  csvOf,
  jstAt,
  type Fill,
} from "../fixtures/rakutenSample";

const USER = "it-imports-user";
const OTHER = "it-imports-other";

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

const fill = (
  no: number,
  kind: "新規" | "決済",
  rate: number,
  pnl: number | null,
): Fill => ({
  no,
  kind,
  side: kind === "新規" ? "買" : "売",
  qty: 10000,
  rate,
  pnl,
  at: jstAt(no - 9000),
});
const file = (fills: Fill[], name = "a.csv") => ({
  name,
  text: csvOf(fills),
});

const count = async (userId: string) =>
  (
    await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM trades WHERE user_id = ${userId}`
  )[0].n;

describe("CSV取り込み（実DB）", () => {
  beforeAll(async () => {
    await makeUser(USER);
    await makeUser(OTHER);
    await settingsService.save(USER, { balanceJpy: 750000 });
  });
  afterAll(async () => {
    await sql`DELETE FROM users WHERE user_id IN ${sql([USER, OTHER])}`;
    await sql.end();
  });

  it("サンプル形式211件を取り込み、再取り込みでは重複が除かれる", async () => {
    const files = [file(buildSample().fills)];
    const first = await importService.commit(USER, files, "skip");
    expect(first).toMatchObject({ imported: 211, skipped: 0, errorCount: 0 });
    expect(await count(USER)).toBe(211);

    const again = await importService.commit(USER, files, "skip");
    expect(again).toMatchObject({ imported: 0, skipped: 211 });
    expect(await count(USER)).toBe(211);

    const pv = await importService.preview(USER, files);
    expect(pv.summary).toMatchObject({ newCount: 0, duplicateCount: 211 });
  });

  it("取り込んだトレードは source=rakuten_csv・手動決済・損益はCSVの値で、未入力キューに入る", async () => {
    const [row] = await sql<
      { source: string; exit_method: string; status: string; pnl: number }[]
    >`SELECT source, exit_method, status, pnl_jpy::int AS pnl
      FROM trades WHERE user_id = ${USER} ORDER BY entry_at LIMIT 1`;
    expect(row).toMatchObject({
      source: "rakuten_csv",
      exit_method: "manual",
      status: "closed",
    });
    const q = await tradeService.queue(USER, {
      filter: "all",
      sort: "entry_desc",
      page: 1,
      limit: 20,
    });
    expect(q.totalCount).toBe(211);
    expect(q.pendingCount).toBe(211);
  });

  it("上書きは価格・損益だけ更新し、根拠メモ・SLは残す", async () => {
    const files = [
      file([fill(9100, "新規", 150, null), fill(9101, "決済", 150.1, 1000)]),
    ];
    await importService.commit(USER, files, "skip");
    await sql`UPDATE trades SET rationale_memo = '押し目', sl_price = 149.8
              WHERE user_id = ${USER} AND source_key = 'rakuten:9100:9101'`;

    const changed = [
      file([fill(9100, "新規", 150, null), fill(9101, "決済", 150.2, 2000)]),
    ];
    const r = await importService.commit(USER, changed, "overwrite");
    expect(r).toMatchObject({ imported: 0, overwritten: 1 });
    const [t] = await sql<
      { memo: string; sl: number; exit: number; pnl: number }[]
    >`SELECT rationale_memo AS memo, sl_price::float8 AS sl,
             exit_price::float8 AS exit, pnl_jpy::int AS pnl
      FROM trades WHERE user_id = ${USER} AND source_key = 'rakuten:9100:9101'`;
    expect(t).toEqual({ memo: "押し目", sl: 149.8, exit: 150.2, pnl: 2000 });
  });

  it("「除いて取り込む」は既存の値を変えない", async () => {
    const changed = [
      file([fill(9100, "新規", 150, null), fill(9101, "決済", 151, 9999)]),
    ];
    const r = await importService.commit(USER, changed, "skip");
    expect(r).toMatchObject({ imported: 0, skipped: 1 });
    const [t] = await sql<{ pnl: number }[]>`
      SELECT pnl_jpy::int AS pnl FROM trades
      WHERE user_id = ${USER} AND source_key = 'rakuten:9100:9101'`;
    expect(t.pnl).toBe(2000);
  });

  it("未決済で取り込んだ後、決済入りのCSVを取り込むと同じトレードが決済済みになる（メモは残る）", async () => {
    await importService.commit(
      USER,
      [file([fill(9200, "新規", 150, null)])],
      "skip",
    );
    const [open] = await sql<{ id: string }[]>`
      SELECT id FROM trades WHERE user_id = ${USER} AND source_key = 'rakuten:9200:'`;
    await sql`UPDATE trades SET rationale_memo = '様子見' WHERE id = ${open.id}`;

    const closed = [
      file([fill(9200, "新規", 150, null), fill(9201, "決済", 150.3, 3000)]),
    ];
    const r = await importService.commit(USER, closed, "skip");
    expect(r).toMatchObject({ imported: 0, completedOpen: 1 });
    const rows = await sql<
      { id: string; status: string; memo: string; key: string; pnl: number }[]
    >`SELECT id, status, rationale_memo AS memo, source_key AS key, pnl_jpy::int AS pnl
      FROM trades WHERE user_id = ${USER} AND entry_at = (
        SELECT entry_at FROM trades WHERE id = ${open.id})`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: open.id,
      status: "closed",
      memo: "様子見",
      key: "rakuten:9200:9201",
      pnl: 3000,
    });
  });

  it("削除したトレードは再取り込みしても復活せず、重複として扱う", async () => {
    await sql`UPDATE trades SET deleted_at = NOW()
              WHERE user_id = ${USER} AND source_key = 'rakuten:9100:9101'`;
    const files = [
      file([fill(9100, "新規", 150, null), fill(9101, "決済", 150.2, 2000)]),
    ];
    const r = await importService.commit(USER, files, "skip");
    expect(r).toMatchObject({ imported: 0, skipped: 1 });
    const [t] = await sql<{ deleted: boolean }[]>`
      SELECT (deleted_at IS NOT NULL) AS deleted FROM trades
      WHERE user_id = ${USER} AND source_key = 'rakuten:9100:9101'`;
    expect(t.deleted).toBe(true);
  });

  it("別のユーザーの取り込み済みには影響されない（user_idごとに重複判定）", async () => {
    const files = [
      file([fill(9100, "新規", 150, null), fill(9101, "決済", 150.2, 2000)]),
    ];
    const r = await importService.commit(OTHER, files, "skip");
    expect(r).toMatchObject({ imported: 1, skipped: 0 });
    expect(await count(OTHER)).toBe(1);
  });
});
