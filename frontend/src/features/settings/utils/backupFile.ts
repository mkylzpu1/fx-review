export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/** 例: fx-review-backup-2026-10-24.json（JSTの日付） */
export function backupFilename(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `fx-review-backup-${jst.toISOString().slice(0, 10)}.json`;
}

export type BackupReadResult =
  { ok: true; body: unknown } | { ok: false; message: string };

/** 選んだファイルが、復元に送れる形かを確かめる（中身の検証はサーバーが行う） */
export function readBackupText(text: string, size: number): BackupReadResult {
  if (size > MAX_BACKUP_BYTES)
    return {
      ok: false,
      message:
        "ファイルが大きすぎます（10MBまで）。別のバックアップを選んでください。",
    };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message:
        "JSONとして読み込めませんでした。FXレビューで保存したバックアップを選んでください。",
    };
  }
  const app =
    typeof body === "object" && body !== null
      ? (body as { app?: unknown }).app
      : undefined;
  if (app !== "fx-review")
    return {
      ok: false,
      message:
        "FXレビューのバックアップではありません。設定の「JSONを保存」で保存したファイルを選んでください。",
    };
  return { ok: true, body };
}

/** Blob.text() が無い環境（jsdomなど）でも読めるよう FileReader を使う */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
