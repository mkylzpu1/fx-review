import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import type { Timeframe } from "@/features/settings/types";
import { apiClient } from "@/services/apiClient";
import type { CandlesResponse } from "../types";
import type { ChartRange } from "../utils/chartRange";
import { toQueryString } from "./useTradesApi";

export const candleKeys = {
  range: (tf: Timeframe, r: ChartRange) =>
    ["candles", tf, r.from, r.to, r.warmup] as const,
};

/** 保存済みの足を指定の時間足で取得する。範囲が決まるまで（range=null）は取得しない */
export function useCandles(tf: Timeframe, range: ChartRange | null) {
  return useQuery({
    queryKey: range ? candleKeys.range(tf, range) : ["candles", "idle"],
    enabled: range !== null,
    retry: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiClient.get<CandlesResponse>(
        `/candles${toQueryString({ tf, ...range })}`,
      ),
  });
}

/** スクロールで追加した範囲を、まとめて取得する（範囲ごとに別のリクエストにして、1回の上限を超えない） */
export function useCandleChunks(tf: Timeframe, ranges: ChartRange[]) {
  return useQueries({
    queries: ranges.map((r) => ({
      queryKey: candleKeys.range(tf, r),
      retry: false,
      staleTime: 5 * 60 * 1000,
      // EMAを足して取り直す間も、読み込み済みの足を消さない（チャートの位置が飛ばないように）
      placeholderData: keepPreviousData,
      queryFn: () =>
        apiClient.get<CandlesResponse>(
          `/candles${toQueryString({ tf, ...r })}`,
        ),
    })),
  });
}
