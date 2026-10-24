import type { ImportFileInput } from "../types";

/** API Gatewayのペイロード上限（10MB）。バックエンドの本文合計上限（8,000,000文字）と揃える */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_CHARS = 8_000_000;
export const MAX_FILES = 20;

export interface ReadFailure {
  name: string;
  message: string;
}

export interface ReadResult {
  files: ImportFileInput[];
  failures: ReadFailure[];
}

/** 楽天FX証券のCSVはShift_JIS（CP932）。UTF-8ではないので明示的にデコードする */
export async function decodeShiftJis(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder("shift_jis").decode(buffer);
}

/** Blob.arrayBuffer() が無い環境（jsdomなど）でも読めるよう FileReader を使う */
function readBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 選んだファイルをテキストにする。
 * 大きすぎるファイル・読めないファイルは、そのファイルだけ失敗として返し、ほかは取り込める。
 */
export async function readCsvFiles(files: File[]): Promise<ReadResult> {
  const ok: ImportFileInput[] = [];
  const failures: ReadFailure[] = [];
  let totalChars = 0;

  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_FILE_BYTES) {
      failures.push({
        name: file.name,
        message:
          "ファイルが大きすぎます（10MBまで）。期間を分けて出力し直してください。",
      });
      continue;
    }
    try {
      const text = await decodeShiftJis(await readBuffer(file));
      if (totalChars + text.length > MAX_TOTAL_CHARS) {
        failures.push({
          name: file.name,
          message:
            "一度に取り込める量を超えます。ファイルを分けて取り込んでください。",
        });
        continue;
      }
      totalChars += text.length;
      ok.push({ name: file.name, text });
    } catch {
      failures.push({
        name: file.name,
        message: "ファイルを読み込めませんでした。もう一度選び直してください。",
      });
    }
  }

  for (const file of files.slice(MAX_FILES)) {
    failures.push({
      name: file.name,
      message: `一度に選べるのは${MAX_FILES}ファイルまでです。`,
    });
  }
  return { files: ok, failures };
}
