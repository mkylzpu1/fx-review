import type { JSONValue } from "postgres";
import { sql } from "../lib/db";

/** user_id を持つテーブル（外部キーの親 → 子の順。復元はこの順に入れる） */
export const OWNED_TABLES = [
  "account_settings",
  "currency_pairs",
  "tags",
  "rules",
  "trades",
  "learning_notes",
  "note_improvements",
  "weekly_reviews",
] as const;

/** user_id を持たず、trades 経由で本人のものと分かるテーブル */
export const LINK_TABLES = ["trade_tags", "trade_rule_checks"] as const;

export type BackupTable =
  (typeof OWNED_TABLES)[number] | (typeof LINK_TABLES)[number];
export type BackupRows = Record<BackupTable, Record<string, unknown>[]>;

/** 子 → 親の順（削除用） */
const DELETE_ORDER = [
  "weekly_reviews",
  "note_improvements",
  "learning_notes",
  "trades", // trade_tags / trade_rule_checks は ON DELETE CASCADE
  "rules",
  "tags",
  "currency_pairs",
  "account_settings",
] as const;

export const backupStore = {
  async exportAll(userId: string): Promise<BackupRows> {
    const owned = await Promise.all(
      OWNED_TABLES.map(
        (t) => sql<{ row: Record<string, unknown> }[]>`
          SELECT to_jsonb(x) AS row FROM ${sql(t)} x WHERE x.user_id = ${userId}
        `,
      ),
    );
    const [tradeTags, ruleChecks] = await Promise.all([
      sql<{ row: Record<string, unknown> }[]>`
        SELECT to_jsonb(x) AS row FROM trade_tags x
        JOIN trades t ON t.id = x.trade_id WHERE t.user_id = ${userId}
      `,
      sql<{ row: Record<string, unknown> }[]>`
        SELECT to_jsonb(x) AS row FROM trade_rule_checks x
        JOIN trades t ON t.id = x.trade_id WHERE t.user_id = ${userId}
      `,
    ]);
    const out = {} as BackupRows;
    OWNED_TABLES.forEach((t, i) => {
      out[t] = owned[i].map((r) => r.row);
    });
    out.trade_tags = tradeTags.map((r) => r.row);
    out.trade_rule_checks = ruleChecks.map((r) => r.row);
    return out;
  },

  /** 本人のデータをすべて消す（ユーザー行は残す）。ローソク足は共有データなので消さない */
  async deleteAll(userId: string): Promise<void> {
    await sql.begin(async (tx) => {
      for (const t of DELETE_ORDER) {
        await tx`DELETE FROM ${tx(t)} WHERE user_id = ${userId}`;
      }
    });
  },

  /** いまのデータを消して、バックアップの内容に置き換える（全部成功か、全部なかったことか） */
  async replaceAll(userId: string, data: BackupRows): Promise<void> {
    await sql.begin(async (tx) => {
      for (const t of DELETE_ORDER) {
        await tx`DELETE FROM ${tx(t)} WHERE user_id = ${userId}`;
      }
      const insert = async (t: BackupTable, withUser: boolean) => {
        const rows = data[t];
        if (rows.length === 0) return;
        // 文字列を ::jsonb にキャストすると二重エンコードになるため、必ず json() で渡す
        const json = tx.json(rows as unknown as JSONValue);
        if (withUser) {
          // user_id は常に本人に上書きする（バックアップ内の値は信用しない）
          await tx`
            INSERT INTO ${tx(t)}
            SELECT * FROM jsonb_populate_recordset(
              null::${tx(t)},
              (SELECT jsonb_agg(e || jsonb_build_object('user_id', ${userId}::text))
               FROM jsonb_array_elements(${json}) e)
            )
          `;
        } else {
          await tx`
            INSERT INTO ${tx(t)}
            SELECT * FROM jsonb_populate_recordset(null::${tx(t)}, ${json})
          `;
        }
      };
      for (const t of OWNED_TABLES) await insert(t, true);
      for (const t of LINK_TABLES) await insert(t, false);
    });
  },
};
