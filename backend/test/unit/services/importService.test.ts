import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/importStore", () => ({
  importStore: {
    findBySourceKeys: vi.fn(),
    findManualTrades: vi.fn(),
    insertMany: vi.fn(),
    overwriteMany: vi.fn(),
    completeManualMany: vi.fn(),
  },
}));

import { importStore } from "../../../src/stores/importStore";
import {
  PREVIEW_TRADE_LIMIT,
  importService,
} from "../../../src/services/import/importService";
import { ValidationError } from "../../../src/lib/errors";
import type { ManualTrade } from "../../../src/types/import";
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

/** 手入力のトレード（pair(1) と同じ取引。日本時間 22:11 = UTC 13:11 の買い 150.000） */
const manualOf = (o: Partial<ManualTrade> = {}): ManualTrade => ({
  id: "manual-1",
  pair: "USDJPY",
  side: "buy",
  lots: 1,
  entryAt: "2026-10-01T13:11:00Z",
  entryPrice: 150,
  exitAt: null,
  status: "open",
  ...o,
});

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
    vi.mocked(importStore.findManualTrades).mockResolvedValue([]);
    vi.mocked(importStore.insertMany).mockImplementation(
      async (_u, t) => t.length,
    );
    vi.mocked(importStore.overwriteMany).mockResolvedValue(0);
    vi.mocked(importStore.completeManualMany).mockImplementation(
      async (_u, items) => items.length,
    );
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

  it("手入力済みのトレードと同じ取引は manual_duplicate（保存しない）", async () => {
    // pair(1): 買い 150.000 / 日本時間 22:11 = UTC 13:11
    vi.mocked(importStore.findManualTrades).mockResolvedValue([
      {
        id: "manual-1",
        pair: "USDJPY",
        side: "buy",
        lots: 1,
        entryAt: "2026-10-01T13:12:00Z", // 1分ずれて手入力
        entryPrice: 150,
        exitAt: null,
        status: "draft",
      },
    ]);
    const r = await importService.preview("u", [
      file([...pair(1), ...pair(11)]),
    ]);
    const by = Object.fromEntries(
      r.trades.map((t) => [t.sourceKey, t.importStatus]),
    );
    expect(by).toEqual({
      "rakuten:1:2": "manual_duplicate",
      "rakuten:11:12": "new",
    });
    expect(r.summary).toMatchObject({
      newCount: 1,
      manualDuplicateCount: 1,
    });
    // 照合する範囲（取り込み候補の最初〜最後 ± 30分）で手入力を読む
    expect(importStore.findManualTrades).toHaveBeenCalledWith(
      "u",
      "2026-10-01T12:41:00.000Z",
      "2026-10-01T13:51:00.000Z",
    );
  });

  it("手入力が未決済でCSVが決済済みなら、決済を埋める件数を数える（行には出さない）", async () => {
    vi.mocked(importStore.findManualTrades).mockResolvedValue([manualOf()]);
    const r = await importService.preview("u", [
      file([...pair(1), ...pair(11)]),
    ]);
    expect(r.summary).toMatchObject({
      manualDuplicateCount: 1,
      completesManualCount: 1,
    });
    expect(r.trades[0]).not.toHaveProperty("completesManual");
    expect(importStore.completeManualMany).not.toHaveBeenCalled();
  });

  it("取り込み済み（duplicate）は手入力と照合しない", async () => {
    existing("rakuten:1:2");
    await importService.preview("u", [file(pair(1))]);
    expect(importStore.findManualTrades).not.toHaveBeenCalled();
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
    vi.mocked(importStore.findManualTrades).mockResolvedValue([]);
    vi.mocked(importStore.insertMany).mockImplementation(
      async (_u, t) => t.length,
    );
    vi.mocked(importStore.overwriteMany).mockResolvedValue(0);
    vi.mocked(importStore.completeManualMany).mockImplementation(
      async (_u, items) => items.length,
    );
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

  it("手入力と同じ取引は、skip でも overwrite でも保存しない。下書きは決済も埋めない", async () => {
    vi.mocked(importStore.findManualTrades).mockResolvedValue([
      manualOf({ status: "draft" }),
    ]);
    for (const mode of ["skip", "overwrite"] as const) {
      vi.mocked(importStore.insertMany).mockClear();
      vi.mocked(importStore.overwriteMany).mockClear();
      vi.mocked(importStore.completeManualMany).mockClear();
      const r = await importService.commit(
        "u",
        [file([...pair(1), ...pair(11)])],
        mode,
      );
      const inserted = vi.mocked(importStore.insertMany).mock.calls[0][1];
      expect(inserted.map((t) => t.sourceKey)).toEqual(["rakuten:11:12"]);
      expect(vi.mocked(importStore.overwriteMany).mock.calls[0][1]).toEqual([]);
      expect(
        vi.mocked(importStore.completeManualMany).mock.calls[0][1],
      ).toEqual([]);
      expect(r).toMatchObject({
        imported: 1,
        manualSkipped: 1,
        completedManual: 0,
        skipped: 0,
        overwritten: 0,
      });
    }
  });

  it("手入力が未決済でCSVが決済済みなら、skip でも overwrite でも決済だけ手入力に埋める", async () => {
    vi.mocked(importStore.findManualTrades).mockResolvedValue([manualOf()]);
    for (const mode of ["skip", "overwrite"] as const) {
      vi.mocked(importStore.insertMany).mockClear();
      vi.mocked(importStore.overwriteMany).mockClear();
      vi.mocked(importStore.completeManualMany).mockClear();
      const r = await importService.commit(
        "u",
        [file([...pair(1), ...pair(11)])],
        mode,
      );
      // CSV側は保存しない（手入力1件に対応づく分）。もう1件は新規として入る
      const inserted = vi.mocked(importStore.insertMany).mock.calls[0][1];
      expect(inserted.map((t) => t.sourceKey)).toEqual(["rakuten:11:12"]);
      expect(vi.mocked(importStore.overwriteMany).mock.calls[0][1]).toEqual([]);
      const done = vi.mocked(importStore.completeManualMany).mock.calls[0][1];
      expect(done).toHaveLength(1);
      expect(done[0].id).toBe("manual-1");
      expect(done[0].trade).toMatchObject({
        sourceKey: "rakuten:1:2",
        exitPrice: 150,
        pnlJpy: 100,
        status: "closed",
      });
      expect(done[0].trade.exitAt).not.toBeNull();
      expect(r).toMatchObject({
        imported: 1,
        manualSkipped: 1,
        completedManual: 1,
      });
    }
  });

  it("手入力がすでに決済済みなら、CSVの決済で書き換えない", async () => {
    vi.mocked(importStore.findManualTrades).mockResolvedValue([
      manualOf({ status: "closed", exitAt: "2026-10-01T13:12:00Z" }),
    ]);
    const r = await importService.commit("u", [file(pair(1))], "overwrite");
    expect(vi.mocked(importStore.completeManualMany).mock.calls[0][1]).toEqual(
      [],
    );
    expect(r).toMatchObject({ manualSkipped: 1, completedManual: 0 });
  });

  it("CSVが未決済なら、手入力の決済は埋めない", async () => {
    vi.mocked(importStore.findManualTrades).mockResolvedValue([manualOf()]);
    const r = await importService.commit(
      "u",
      [file([f({ no: 1, kind: "新規", side: "買" })])],
      "skip",
    );
    expect(vi.mocked(importStore.completeManualMany).mock.calls[0][1]).toEqual(
      [],
    );
    expect(r).toMatchObject({ manualSkipped: 1, completedManual: 0 });
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
