import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * ローソク足の同期を行う、手元専用サーバー（backend の sync:server。make dev で起動する）のURL。
 * 本番など、サーバーが無い環境では空になり、ボタンは使えない。
 */
export const CANDLE_SYNC_URL: string =
  import.meta.env.VITE_LOCAL_SYNC_URL ??
  (import.meta.env.DEV ? "http://localhost:3100" : "");

export interface CandleSyncResult {
  fetched: number;
  /** 取り込んだ範囲の数（トレードの時間帯をまとめたもの） */
  windows?: number;
  excursion: { total: number; withData: number };
}

/** サーバーに届かなかった（起動していない・ネットワークの問題）ときのエラー */
export class SyncServerUnreachable extends Error {}

/** days を省略すると、全トレードの時間帯分を取り込む */
async function requestSync(days?: number): Promise<CandleSyncResult> {
  let res: Response;
  try {
    res = await fetch(`${CANDLE_SYNC_URL}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(days === undefined ? {} : { days }),
    });
  } catch {
    throw new SyncServerUnreachable();
  }
  const json = (await res.json().catch(() => null)) as
    ({ ok: true } & CandleSyncResult) | { ok: false; message?: string } | null;
  if (!json || !json.ok)
    throw new Error(
      json && !json.ok && json.message ? json.message : "更新できませんでした",
    );
  return json;
}

/** MT5が書き出したCSVを、DBのローソク足に取り込む。終わったら、チャートの足を取り直す */
export function useCandleSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days?: number) => requestSync(days),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candles"] }),
  });
}
