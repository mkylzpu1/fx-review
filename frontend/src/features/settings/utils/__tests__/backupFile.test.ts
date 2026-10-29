import { describe, it, expect } from "vitest";
import {
  MAX_BACKUP_BYTES,
  backupFilename,
  readBackupText,
} from "../backupFile";

describe("backupFile", () => {
  it("ファイル名はJSTの日付", () => {
    expect(backupFilename(new Date("2026-10-24T16:00:00Z"))).toBe(
      "fx-review-backup-2026-10-25.json",
    );
  });

  it("とれみるのバックアップは受け付ける", () => {
    const r = readBackupText('{"app":"fx-review","version":1,"data":{}}', 40);
    expect(r.ok).toBe(true);
  });

  it("JSONでない・別アプリ・大きすぎるファイルは、直し方つきで弾く", () => {
    const bad = readBackupText("hello", 5);
    expect(bad).toMatchObject({ ok: false });
    const other = readBackupText('{"app":"other"}', 15);
    expect(other).toMatchObject({ ok: false });
    expect(other.ok === false && other.message).toMatch(/JSONを保存/);
    expect(readBackupText("{}", MAX_BACKUP_BYTES + 1)).toMatchObject({
      ok: false,
    });
    expect(readBackupText("null", 4)).toMatchObject({ ok: false });
  });
});
