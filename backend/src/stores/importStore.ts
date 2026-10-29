import { sql } from "../lib/db";
import type { ImportTrade, ManualTrade } from "../types/import";

export interface ExistingTrade {
  id: string;
  sourceKey: string;
  deleted: boolean;
}

const CHUNK = 500;
const chunks = <T>(xs: T[], n = CHUNK): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
    xs.slice(i * n, (i + 1) * n),
  );

/** CSV取り込み用のSQL（ロジックは services/import に置く） */
export const importStore = {
  /** 指定の source_key を持つトレード。削除済みも含める（ユニーク制約の対象のため） */
  async findBySourceKeys(
    userId: string,
    keys: string[],
  ): Promise<ExistingTrade[]> {
    const out: ExistingTrade[] = [];
    for (const part of chunks(keys, 2000)) {
      out.push(
        ...(await sql<ExistingTrade[]>`
          SELECT id, source_key as "sourceKey", (deleted_at IS NOT NULL) as deleted
          FROM trades
          WHERE user_id = ${userId} AND source_key IN ${sql(part)}
        `),
      );
    }
    return out;
  },

  /**
   * 手入力のトレード（未削除）のうち、エントリーが [fromIso, toIso] にあるもの。
   * CSVの取引と同じものか照合するために読む（下書きも含める）
   */
  async findManualTrades(
    userId: string,
    fromIso: string,
    toIso: string,
  ): Promise<ManualTrade[]> {
    const rows = await sql<
      (Omit<ManualTrade, "entryAt" | "exitAt"> & {
        entryAt: Date | string;
        exitAt: Date | string | null;
      })[]
    >`
      SELECT id, pair, side, lots::float8 as lots,
        entry_at as "entryAt", entry_price::float8 as "entryPrice",
        exit_at as "exitAt"
      FROM trades
      WHERE user_id = ${userId} AND source = 'manual' AND deleted_at IS NULL
        AND entry_at >= ${fromIso}::timestamptz
        AND entry_at <= ${toIso}::timestamptz
    `;
    const iso = (v: Date | string) =>
      new Date(v).toISOString().replace(/\.\d{3}Z$/, "Z");
    return rows.map((r) => ({
      ...r,
      entryAt: iso(r.entryAt),
      exitAt: r.exitAt === null ? null : iso(r.exitAt),
    }));
  },

  /** 新規取り込み（1トランザクション）。同時実行で重なった行は入れず、入れた件数を返す */
  async insertMany(userId: string, trades: ImportTrade[]): Promise<number> {
    if (trades.length === 0) return 0;
    return sql.begin(async (tx) => {
      let inserted = 0;
      for (const part of chunks(trades)) {
        const rows = part.map((t) => ({
          user_id: userId,
          source: "rakuten_csv",
          source_key: t.sourceKey,
          pair: t.pair,
          side: t.side,
          lots: t.lots,
          entry_at: t.entryAt,
          entry_price: t.entryPrice,
          exit_at: t.exitAt,
          exit_price: t.exitPrice,
          exit_method: t.status === "closed" ? "manual" : "open",
          pnl_jpy: t.pnlJpy,
          status: t.status,
        }));
        const res = await tx`
          INSERT INTO trades ${tx(
            rows,
            "user_id",
            "source",
            "source_key",
            "pair",
            "side",
            "lots",
            "entry_at",
            "entry_price",
            "exit_at",
            "exit_price",
            "exit_method",
            "pnl_jpy",
            "status",
          )}
          ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING
          RETURNING id
        `;
        inserted += res.length;
      }
      return inserted;
    });
  },

  /**
   * CSVの値で価格・損益だけを更新する（根拠・メモ・SL・TP・タグ・決済の仕方は残す）。
   * 未決済だったトレードが決済された場合は決済を埋め、source_key も決済ありのものに直す。
   * 保有中の最大含み益/損は古い値になるので消す（次の同期で再計算される）。
   */
  async overwriteMany(
    userId: string,
    items: { id: string; trade: ImportTrade; completesOpen: boolean }[],
  ): Promise<number> {
    if (items.length === 0) return 0;
    return sql.begin(async (tx) => {
      let n = 0;
      for (const { id, trade: t, completesOpen } of items) {
        const res = await tx`
          UPDATE trades SET
            side = ${t.side}, lots = ${t.lots},
            entry_at = ${t.entryAt}, entry_price = ${t.entryPrice},
            exit_at = ${t.exitAt}, exit_price = ${t.exitPrice},
            pnl_jpy = ${t.pnlJpy}, status = ${t.status},
            exit_method = CASE
              WHEN ${completesOpen} THEN 'manual'
              WHEN ${t.status === "open"} THEN 'open'
              ELSE exit_method END,
            source_key = ${t.sourceKey},
            mfe_pips = NULL, mae_pips = NULL, after_max_pips = NULL,
            updated_at = NOW()
          WHERE user_id = ${userId} AND id = ${id}
          RETURNING id
        `;
        n += res.length;
      }
      return n;
    });
  },
};
