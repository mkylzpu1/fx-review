import { ValidationError } from "../../lib/errors";
import { importStore } from "../../stores/importStore";
import type {
  ImportFileResult,
  ImportRowError,
  ImportTrade,
} from "../../types/import";
import { pairExecutions, toSourceKey } from "./pairing";
import { parseRakutenFile } from "./rakutenCsv";

/** API Gatewayのペイロード上限（10MB）に余裕を持たせた、本文の合計上限 */
export const MAX_TOTAL_CHARS = 8_000_000;
export const MAX_FILES = 20;
/** プレビューで返す行数・エラー数の上限（全件はサーバー側で集計する） */
export const PREVIEW_TRADE_LIMIT = 100;
export const ERROR_LIMIT = 200;

export type DuplicateMode = "skip" | "overwrite";
export type PreviewStatus = "new" | "duplicate" | "completes_open";

export interface ImportFileInput {
  name: string;
  text: string;
}

export interface PreviewTrade extends ImportTrade {
  importStatus: PreviewStatus;
}

export interface PreviewSummary {
  /** 取り込める行から作ったトレードの数 */
  total: number;
  newCount: number;
  duplicateCount: number;
  /** 未決済で取り込み済みだったトレードが、今回のCSVで決済済みになる件数 */
  completesOpenCount: number;
  openCount: number;
  errorCount: number;
  /** 複数ファイルで重なっていた約定の行数 */
  overlappedRows: number;
}

export interface PreviewResult {
  files: ImportFileResult[];
  summary: PreviewSummary;
  trades: PreviewTrade[];
  errors: ImportRowError[];
  /** 日付の範囲（UTC）。ローソク足の同期範囲の案内に使う */
  entryRange: { from: string; to: string } | null;
}

export interface CommitResult {
  imported: number;
  /** 取り込み済みのため除いた件数（skip）または上書きした件数（overwrite） */
  skipped: number;
  overwritten: number;
  completedOpen: number;
  errorCount: number;
  files: ImportFileResult[];
  entryRange: { from: string; to: string } | null;
}

interface Analysis {
  files: ImportFileResult[];
  errors: ImportRowError[];
  classified: (ImportTrade & {
    importStatus: PreviewStatus;
    existingId: string | null;
  })[];
  overlappedRows: number;
}

function assertFiles(files: ImportFileInput[]) {
  if (files.length === 0) throw new ValidationError("ファイルがありません");
  if (files.length > MAX_FILES)
    throw new ValidationError(`ファイルは${MAX_FILES}個までです`);
  const total = files.reduce((n, f) => n + f.text.length, 0);
  if (total > MAX_TOTAL_CHARS)
    throw new ValidationError(
      "ファイルの合計サイズが大きすぎます。期間を分けて取り込んでください",
    );
}

async function analyze(
  userId: string,
  files: ImportFileInput[],
): Promise<Analysis> {
  assertFiles(files);
  const parsed = files.map((f) => parseRakutenFile(f.name, f.text));
  const rows = parsed.flatMap((p) => p.rows);
  const rowErrors = parsed.flatMap((p) => p.errors);
  const pairing = pairExecutions(rows);

  // 重複判定: 同じ source_key、または未決済で取り込み済みだったものの続き
  const keys = pairing.trades.flatMap((t) =>
    t.status === "closed"
      ? [t.sourceKey, toSourceKey(t.entryNo, null)]
      : [t.sourceKey],
  );
  const existing = new Map(
    (await importStore.findBySourceKeys(userId, keys)).map((e) => [
      e.sourceKey,
      e,
    ]),
  );

  const classified = pairing.trades.map((t) => {
    const same = existing.get(t.sourceKey);
    if (same)
      return { ...t, importStatus: "duplicate" as const, existingId: same.id };
    const openBefore =
      t.status === "closed"
        ? existing.get(toSourceKey(t.entryNo, null))
        : undefined;
    if (openBefore)
      return {
        ...t,
        importStatus: "completes_open" as const,
        existingId: openBefore.id,
      };
    return { ...t, importStatus: "new" as const, existingId: null };
  });

  return {
    files: parsed.map((p) => p.file),
    errors: [...rowErrors, ...pairing.errors],
    classified,
    overlappedRows: pairing.duplicateRows,
  };
}

function entryRange(trades: ImportTrade[]) {
  if (trades.length === 0) return null;
  const ats = trades.map((t) => t.entryAt).sort();
  return { from: ats[0], to: ats[ats.length - 1] };
}

export const importService = {
  async preview(
    userId: string,
    files: ImportFileInput[],
  ): Promise<PreviewResult> {
    const a = await analyze(userId, files);
    const count = (s: PreviewStatus) =>
      a.classified.filter((t) => t.importStatus === s).length;
    const newest = [...a.classified]
      .sort((x, y) =>
        x.entryAt < y.entryAt ? 1 : x.entryAt > y.entryAt ? -1 : 0,
      )
      .slice(0, PREVIEW_TRADE_LIMIT)
      .map(({ existingId: _ignored, ...t }) => t);
    return {
      files: a.files,
      summary: {
        total: a.classified.length,
        newCount: count("new"),
        duplicateCount: count("duplicate"),
        completesOpenCount: count("completes_open"),
        openCount: a.classified.filter((t) => t.status === "open").length,
        errorCount: a.errors.length,
        overlappedRows: a.overlappedRows,
      },
      trades: newest,
      errors: a.errors.slice(0, ERROR_LIMIT),
      entryRange: entryRange(a.classified),
    };
  },

  /**
   * 確定。重複は mode で扱いを選ぶ。
   * - skip: 取り込み済みを除いて新規だけ入れる
   * - overwrite: 取り込み済みの価格・損益だけCSVの値で更新する（根拠・メモ・SL・TPは残す）
   * 未決済→決済済みへの更新（completes_open）は、どちらのモードでも行う。
   */
  async commit(
    userId: string,
    files: ImportFileInput[],
    mode: DuplicateMode,
  ): Promise<CommitResult> {
    const a = await analyze(userId, files);
    const fresh = a.classified.filter((t) => t.importStatus === "new");
    const dups = a.classified.filter((t) => t.importStatus === "duplicate");
    const completes = a.classified.filter(
      (t) => t.importStatus === "completes_open",
    );

    const inserted = await importStore.insertMany(userId, fresh);
    const toUpdate = [
      ...completes.map((t) => ({
        id: t.existingId!,
        trade: t,
        completesOpen: true,
      })),
      ...(mode === "overwrite"
        ? dups.map((t) => ({
            id: t.existingId!,
            trade: t,
            completesOpen: false,
          }))
        : []),
    ];
    await importStore.overwriteMany(userId, toUpdate);

    return {
      imported: inserted,
      skipped: mode === "skip" ? dups.length + (fresh.length - inserted) : 0,
      overwritten: mode === "overwrite" ? dups.length : 0,
      completedOpen: completes.length,
      errorCount: a.errors.length,
      files: a.files,
      entryRange: entryRange(a.classified),
    };
  },
};
