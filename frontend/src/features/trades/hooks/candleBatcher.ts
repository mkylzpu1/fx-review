import { ApiError, apiClient } from "@/services/apiClient";
import type { Timeframe } from "@/features/settings/types";
import type { CandlesResponse } from "../types";
import type { ChartRange } from "../utils/chartRange";

/** バックエンド POST /candles/batch の1回あたりの上限と同じ */
export const MAX_BATCH = 30;
/** 同じ画面で続けて出た要求を、ひとまとめにするために待つ時間 */
const WINDOW_MS = 30;

type BatchItem =
  | { ok: true; data: CandlesResponse }
  | { ok: false; code: string; message: string };

interface Pending {
  tf: Timeframe;
  range: ChartRange;
  resolve: (v: CandlesResponse) => void;
  reject: (e: unknown) => void;
}

const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  timer = null;
  const batch = queue.splice(0, MAX_BATCH);
  if (queue.length > 0) timer = setTimeout(() => void flush(), 0);
  if (batch.length === 0) return;
  try {
    const { results } = await apiClient.post<{ results: BatchItem[] }>(
      "/candles/batch",
      {
        requests: batch.map((p) => ({
          tf: p.tf,
          from: p.range.from,
          to: p.range.to,
          warmup: p.range.warmup,
        })),
      },
    );
    batch.forEach((p, i) => {
      const r = results[i];
      if (r?.ok) p.resolve(r.data);
      else
        p.reject(
          new ApiError(
            r?.code ?? "UNKNOWN",
            r?.message ?? "足データを取得できませんでした",
            400,
          ),
        );
    });
  } catch (e) {
    for (const p of batch) p.reject(e);
  }
}

/**
 * 一覧の各行のチャートなど、短い間に出た複数の足の要求を1回のリクエストにまとめて取得する。
 * 行ごとに別々のリクエストを送らない（N+1を避ける）。
 */
export function fetchCandlesBatched(
  tf: Timeframe,
  range: ChartRange,
): Promise<CandlesResponse> {
  return new Promise((resolve, reject) => {
    queue.push({ tf, range, resolve, reject });
    if (queue.length >= MAX_BATCH) {
      if (timer) clearTimeout(timer);
      void flush();
    } else if (!timer) {
      timer = setTimeout(() => void flush(), WINDOW_MS);
    }
  });
}
