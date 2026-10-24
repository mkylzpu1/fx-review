import { z } from "zod";
import { ValidationError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import {
  backupStore,
  LINK_TABLES,
  OWNED_TABLES,
  type BackupRows,
  type BackupTable,
} from "../../stores/backupStore";

export const BACKUP_APP = "fx-review";
export const BACKUP_VERSION = 1;

const Rows = z.array(z.record(z.unknown())).optional();

const shape = Object.fromEntries(
  [...OWNED_TABLES, ...LINK_TABLES].map((t) => [t, Rows]),
) as Record<BackupTable, typeof Rows>;

/** POST /backup/restore のボディ */
export const BackupFileSchema = z.object({
  app: z.literal(BACKUP_APP, {
    errorMap: () => ({ message: "FXレビューのバックアップではありません" }),
  }),
  version: z.literal(BACKUP_VERSION, {
    errorMap: () => ({ message: "対応していないバックアップのバージョンです" }),
  }),
  data: z.object(shape),
});

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: BackupRows;
}

const BAD_REF =
  "バックアップの内容が正しくありません（つながりが壊れています）";

const idSet = (rows: Record<string, unknown>[], key = "id") =>
  new Set(rows.map((r) => String(r[key])));

/** 参照先がバックアップの中に無い行があれば拒否する（他人のデータを指す行を入れさせない） */
export function assertReferences(data: BackupRows): void {
  const trades = idSet(data.trades);
  const tags = idSet(data.tags);
  const rules = idSet(data.rules);
  const notes = idSet(data.learning_notes);
  const optional = (v: unknown, set: Set<string>) =>
    v === null || v === undefined || set.has(String(v));

  const ok =
    data.trade_tags.every(
      (r) => trades.has(String(r.trade_id)) && tags.has(String(r.tag_id)),
    ) &&
    data.trade_rule_checks.every(
      (r) => trades.has(String(r.trade_id)) && rules.has(String(r.rule_id)),
    ) &&
    data.note_improvements.every(
      (r) => notes.has(String(r.note_id)) && optional(r.rule_id, rules),
    ) &&
    data.learning_notes.every((r) => optional(r.source_trade_id, trades)) &&
    data.weekly_reviews.every((r) => optional(r.next_rule_id, rules));
  if (!ok) throw new ValidationError(BAD_REF);
}

export const backupService = {
  async export(userId: string, now: Date = new Date()): Promise<BackupFile> {
    return {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      data: await backupStore.exportAll(userId),
    };
  },

  async restore(
    userId: string,
    file: z.infer<typeof BackupFileSchema>,
  ): Promise<{ trades: number }> {
    // 欠けているテーブルは空として扱う
    const data = {} as BackupRows;
    for (const t of [...OWNED_TABLES, ...LINK_TABLES]) {
      data[t] = file.data[t] ?? [];
    }
    assertReferences(data);
    try {
      await backupStore.replaceAll(userId, data);
    } catch (e) {
      // 列の型の不一致・重複などは、ファイルの問題として返す（DBは巻き戻っている）
      logger.error("バックアップの復元に失敗", { userId, error: String(e) });
      throw new ValidationError(
        "バックアップを読み込めませんでした。ファイルが壊れているか、別のバージョンの可能性があります。いまのデータは変わっていません。",
      );
    }
    return { trades: data.trades.length };
  },

  async deleteAll(userId: string): Promise<void> {
    await backupStore.deleteAll(userId);
  },
};
