import { useMutation } from "@tanstack/react-query";
import { decodeShiftJis } from "../utils/readCsvFile";

/**
 * 楽天FX WebTraderのCSVを自動ダウンロードする、手元専用サーバー（Hammerspoon）のURL。
 * 導入は hammerspoon/README.md を参照。本番など、サーバーが無い環境では空になり、
 * ボタンは使えない（candle syncと同じ考え方）。
 */
export const RAKUTEN_BRIDGE_URL: string =
  import.meta.env.VITE_RAKUTEN_BRIDGE_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:17391" : "");

export type RakutenImportKind = "execution" | "order";

/** サーバーに届かなかった（起動していない・ネットワークの問題）ときのエラー */
export class RakutenBridgeUnreachable extends Error {}

interface StartResponse {
  ok: boolean;
  jobId?: string;
  message?: string;
}

type StatusResponse =
  | { ok: true; status: "running" }
  | { ok: true; status: "done"; name: string; contentBase64: string }
  | { ok: true; status: "error"; message: string }
  | { ok: false; message?: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${RAKUTEN_BRIDGE_URL}${path}`, init);
  } catch {
    throw new RakutenBridgeUnreachable();
  }
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) throw new Error("応答を読めませんでした");
  return json;
}

/** CSVの拡張子を保ったまま、File（UTF-8として扱うが中身はCSVそのまま）を作る */
async function toFile(name: string, contentBase64: string): Promise<File> {
  const buffer = base64ToArrayBuffer(contentBase64);
  // Shift_JISのバイト列からUTF-8文字列へ（readCsvFiles と同じデコードを通す）
  const text = await decodeShiftJis(buffer);
  return new File([text], name, { type: "text/csv" });
}

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 30_000;

async function runImport(kind: RakutenImportKind, date: string): Promise<File> {
  const start = await requestJson<StartResponse>("/rakuten-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, kind }),
  });
  if (!start.ok || !start.jobId)
    throw new Error(start.message ?? "開始できませんでした");

  const jobId = start.jobId;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    const status = await requestJson<StatusResponse>(
      `/rakuten-import/status?job=${encodeURIComponent(jobId)}`,
    );
    if (!status.ok) throw new Error(status.message ?? "確認できませんでした");
    if (status.status === "running") {
      if (Date.now() > deadline) throw new Error("時間内に終わりませんでした");
      continue;
    }
    if (status.status === "error") throw new Error(status.message);
    return toFile(status.name, status.contentBase64);
  }
}

/** 楽天FX WebTraderから、指定した開始日のCSVを自動ダウンロードする（約定履歴 or 注文履歴） */
export function useRakutenImport() {
  return useMutation({
    mutationFn: (v: { kind: RakutenImportKind; date: string }) =>
      runImport(v.kind, v.date),
  });
}
