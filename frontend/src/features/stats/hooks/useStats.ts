import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import type { PeriodKey, StatsResult } from "../types";
import { periodFrom, previousPeriod, todayStartJst } from "../utils/period";

export function useStats(period: PeriodKey, pair?: string) {
  return useQuery({
    queryKey: ["stats", period, pair ?? ""],
    queryFn: () =>
      apiClient.get<StatsResult>(
        `/stats${toQueryString({ from: periodFrom(period), pair })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

/** 直前の同じ長さの期間の統計（比較用）。「すべて」では取得しない */
export function usePreviousStats(period: PeriodKey) {
  const prev = previousPeriod(period);
  return useQuery({
    queryKey: ["stats", "previous", period],
    enabled: prev !== null,
    queryFn: () =>
      apiClient.get<StatsResult>(`/stats${toQueryString(prev ?? {})}`),
  });
}

/** 今日（JST）の統計。トップ画面の「今日の状況」用 */
export function useTodayStats() {
  return useQuery({
    queryKey: ["stats", "today"],
    queryFn: () =>
      apiClient.get<StatsResult>(
        `/stats${toQueryString({ from: todayStartJst() })}`,
      ),
  });
}
