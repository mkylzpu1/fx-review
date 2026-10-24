import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/importStore", () => ({
  importStore: {
    findBySourceKeys: vi.fn(),
    insertMany: vi.fn(),
    overwriteMany: vi.fn(),
  },
}));

import { importStore } from "../../../src/stores/importStore";
import {
  PREVIEW_TRADE_LIMIT,
  importService,
} from "../../../src/services/import/importService";
import { ValidationError } from "../../../src/lib/errors";
import {
  buildSample,
  csvOf,
  jstAt,
  type Fill,
} from "../../fixtures/rakutenSample";

const f = (o: Partial<Fill> & Pick<Fill, "no" | "kind" | "side">): Fill => ({
  qty: 10000,
  rate: 150,
  pnl: o.kind === "決済" ? 100 : null,
  at: jstAt(o.no),
  ...o,
});
const file = (fills: Fill[], name = "a.csv") => ({
  name,
  text: csvOf(fills),
});
const pair = (n: number) => [
  f({ no: n, kind: "新規", side: "買" }),
  f({ no: n + 1, kind: "決済", side: "売" }),
];

const existing = (...keys: string[]) =>
  vi
    .mocked(importStore.findBySourceKeys)
    .mockResolvedValue(
      keys.map((k, i) => ({ id: `id${i}`, sourceKey: k, deleted: false })),
    );

describe("importService.preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(importStore.findBySourceKeys).mockResolvedValue([]);
    vi.mocked(importStore.insertMany).mockImplementation(
      async (_u, t) => t.length,
    );
    vi.mocked(importStore.overwriteMany).mockResolvedValue(0);
  });

  it("サンプル形式211件が全件新規として集計され、保存はしない", async () => {
    const r = await importService.preview("u", [file(buildSample().fills)]);
    expect(r.summary).toMatchObject({
      total: 211,
      newCount: 211,
      duplicateCount: 0,
      errorCount: 0,
      openCount: 0,
    });
    expect(r.trades).toHaveLength(PREVIEW_TRADE_LIMIT); // 全件は返さない
    expect(r.trades[0].entryAt >= r.trades[1].entryAt).toBe(true); // 新しい順
    expect(importStore.insertMany).not.toHaveBeenCalled();
    expect(r.entryRange?.from).toBe("2026-10-01T13:10:00Z");
  });

  it("取り込み済みは duplicate、未決済だったものの続きは completes_open", async () => {
    existing("rakuten:1:2", "rakuten:11:");
    const r = await importService.preview("u", [
      file([...pair(1), ...pair(11), ...pair(21)]),
    ]);
    const by = Object.fromEntries(
      r.trades.map((t) => [t.sourceKey, t.importStatus]),
    );
    expect(by).toEqual({
      "rakuten:1:2": "duplicate",
      "rakuten:11:12": "completes_open",
      "rakuten:21:22": "new",
    });
    expect(r.summary).toMatchObject({
      newCount: 1,
      duplicateCount: 1,
      completesOpenCount: 1,
    });
  });

  it("別形式のファイルだけエラーにし、他のファイルは読む", async () => {
    const r = await importService.preview("u", [
      file(pair(1)),
      { name: "other.csv", text: '"日付","金額"\r\n"1","2"\r\n' },
    ]);
    expect(r.files.map((x) => x.status)).toEqual(["ok", "error"]);
    expect(r.summary.total).toBe(1);
  });

  it("エラー行は件数を全件分数え、返すのは上限まで", async () => {
    const bad = Array.from({ length: 250 }, (_, i) =>
      f({ no: 5000 + i, kind: "決済", side: "売" }),
    );
    const r = await importService.preview("u", [file(bad)]);
    expect(r.summary.errorCount).toBe(250);
    expect(r.errors).toHaveLength(200);
  });

  it("ファイルが無い・多すぎる・大きすぎるときは400", async () => {
    await expect(importService.preview("u", [])).rejects.toBeInstanceOf(
      ValidationError,
    );
    const many = Array.from({ length: 21 }, (_, i) =>
      file(pair(1), `${i}.csv`),
    );
    await expect(importService.preview("u", many)).rejects.toBeInstanceOf(
      ValidationError,
    );
    const big = { name: "big.csv", text: "x".repeat(8_000_001) };
    await expect(importService.preview("u", [big])).rejects.toThrow(
      "合計サイズ",
    );
  });
});

describe("importService.commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(importStore.findBySourceKeys).mockResolvedValue([]);
    vi.mocked(importStore.insertMany).mockImplementation(
      async (_u, t) => t.length,
    );
    vi.mocked(importStore.overwriteMany).mockResolvedValue(0);
  });

  it("skip: 新規だけ入れ、取り込み済みは触らない", async () => {
    existing("rakuten:1:2");
    const r = await importService.commit(
      "u",
      [file([...pair(1), ...pair(11)])],
      "skip",
    );
    const inserted = vi.mocked(importStore.insertMany).mock.calls[0][1];
    expect(inserted.map((t) => t.sourceKey)).toEqual(["rakuten:11:12"]);
    expect(vi.mocked(importStore.overwriteMany).mock.calls[0][1]).toEqual([]);
    expect(r).toMatchObject({ imported: 1, skipped: 1, overwritten: 0 });
  });

  it("overwrite: 取り込み済みを更新する（新規は追加）", async () => {
    existing("rakuten:1:2");
    const r = await importService.commit(
      "u",
      [file([...pair(1), ...pair(11)])],
      "overwrite",
    );
    const upd = vi.mocked(importStore.overwriteMany).mock.calls[0][1];
    expect(upd).toHaveLength(1);
    expect(upd[0]).toMatchObject({ id: "id0", completesOpen: false });
    expect(r).toMatchObject({ imported: 1, skipped: 0, overwritten: 1 });
  });

  it("未決済→決済済みは、skipでも決済を埋める", async () => {
    existing("rakuten:1:");
    const r = await importService.commit("u", [file(pair(1))], "skip");
    const upd = vi.mocked(importStore.overwriteMany).mock.calls[0][1];
    expect(upd).toHaveLength(1);
    expect(upd[0]).toMatchObject({ completesOpen: true });
    expect(upd[0].trade.sourceKey).toBe("rakuten:1:2");
    expect(r).toMatchObject({ imported: 0, completedOpen: 1 });
  });

  it("同時実行で先に入った行は取り込んだ件数に数えず、除いた件数に足す", async () => {
    vi.mocked(importStore.insertMany).mockResolvedValue(0);
    const r = await importService.commit("u", [file(pair(1))], "skip");
    expect(r).toMatchObject({ imported: 0, skipped: 1 });
  });

  it("エラー行があっても、取り込める行は取り込む", async () => {
    const r = await importService.commit(
      "u",
      [file([...pair(1), f({ no: 99, kind: "決済", side: "売" })])],
      "skip",
    );
    expect(r).toMatchObject({ imported: 1, errorCount: 1 });
  });
});
