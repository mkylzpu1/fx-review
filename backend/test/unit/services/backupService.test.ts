import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/backupStore", async (orig) => ({
  ...(await orig<typeof import("../../../src/stores/backupStore")>()),
  backupStore: {
    exportAll: vi.fn(),
    replaceAll: vi.fn(),
    deleteAll: vi.fn(),
  },
}));

import {
  assertReferences,
  backupService,
  BackupFileSchema,
} from "../../../src/services/backup/backupService";
import { backupStore, type BackupRows } from "../../../src/stores/backupStore";
import { ValidationError } from "../../../src/lib/errors";

const empty = (): BackupRows => ({
  account_settings: [],
  currency_pairs: [],
  tags: [],
  rules: [],
  trades: [],
  learning_notes: [],
  note_improvements: [],
  weekly_reviews: [],
  trade_tags: [],
  trade_rule_checks: [],
});

describe("backupService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("エクスポートは app・version・日時つきで返す", async () => {
    vi.mocked(backupStore.exportAll).mockResolvedValue(empty());
    const f = await backupService.export("u", new Date("2026-10-24T00:00:00Z"));
    expect(f).toMatchObject({
      app: "fx-review",
      version: 1,
      exportedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(backupStore.exportAll).toHaveBeenCalledWith("u");
  });

  it("他のアプリ・別バージョンのファイルは弾く", () => {
    expect(
      BackupFileSchema.safeParse({ app: "other", version: 1, data: {} })
        .success,
    ).toBe(false);
    expect(
      BackupFileSchema.safeParse({ app: "fx-review", version: 2, data: {} })
        .success,
    ).toBe(false);
  });

  it("テーブルが欠けていても読め、復元では空として扱う", async () => {
    const file = BackupFileSchema.parse({
      app: "fx-review",
      version: 1,
      data: {},
    });
    vi.mocked(backupStore.replaceAll).mockResolvedValue();
    await backupService.restore("u", file);
    expect(vi.mocked(backupStore.replaceAll).mock.calls[0][1].trades).toEqual(
      [],
    );
  });

  it("バックアップ内に無いトレード・タグを指す行は拒否する（他人のデータを指させない）", () => {
    const d = empty();
    d.trades = [{ id: "t1" }];
    d.tags = [{ id: "g1" }];
    d.trade_tags = [{ trade_id: "other-user-trade", tag_id: "g1" }];
    expect(() => assertReferences(d)).toThrow(ValidationError);

    d.trade_tags = [{ trade_id: "t1", tag_id: "g1" }];
    expect(() => assertReferences(d)).not.toThrow();
  });

  it("ルール・メモ・週次レビューの参照も確認する。null は許す", () => {
    const d = empty();
    d.rules = [{ id: "r1" }];
    d.learning_notes = [{ id: "n1", source_trade_id: null }];
    d.note_improvements = [{ note_id: "n1", rule_id: "r1" }];
    d.weekly_reviews = [{ next_rule_id: null }];
    expect(() => assertReferences(d)).not.toThrow();

    d.note_improvements = [{ note_id: "n1", rule_id: "zzz" }];
    expect(() => assertReferences(d)).toThrow(ValidationError);
    d.note_improvements = [];
    d.weekly_reviews = [{ next_rule_id: "zzz" }];
    expect(() => assertReferences(d)).toThrow(ValidationError);
  });

  it("復元は件数を返す。DBが失敗したらファイルの問題として返し、成功を装わない", async () => {
    const file = BackupFileSchema.parse({
      app: "fx-review",
      version: 1,
      data: { trades: [{ id: "t1" }] },
    });
    vi.mocked(backupStore.replaceAll).mockResolvedValue();
    expect(await backupService.restore("u", file)).toEqual({ trades: 1 });

    vi.mocked(backupStore.replaceAll).mockRejectedValue(new Error("22P02"));
    await expect(backupService.restore("u", file)).rejects.toThrow(
      /いまのデータは変わっていません/,
    );
  });

  it("参照が壊れていたら、DBに触れる前に拒否する", async () => {
    const file = BackupFileSchema.parse({
      app: "fx-review",
      version: 1,
      data: { trade_tags: [{ trade_id: "x", tag_id: "y" }] },
    });
    await expect(backupService.restore("u", file)).rejects.toThrow(
      ValidationError,
    );
    expect(backupStore.replaceAll).not.toHaveBeenCalled();
  });

  it("全削除は本人のIDで呼ぶ", async () => {
    await backupService.deleteAll("u");
    expect(backupStore.deleteAll).toHaveBeenCalledWith("u");
  });
});
