import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import type { PeriodKey, StatsResult } from "../types";
import {
  customRange,
  periodRange,
  previousPeriod,
  todayStartJst,
} from "../utils/period";

/** "custom"（期間を指定）のときに選んだ開始日・終了日（"YYYY-MM-DD"） */
export interface CustomDateRange {
  from: string;
  to: string;
}

export function useStats(
  period: PeriodKey,
  pair?: string,
  custom?: CustomDateRange,
) {
  const isCustom = period === "custom";
  const range = isCustom
    ? custom && customRange(custom.from, custom.to)
    : periodRange(period);
  return useQuery({
    queryKey: ["stats", period, pair ?? "", custom?.from ?? "", custom?.to ?? ""],
    enabled: !isCustom || Boolean(range),
    queryFn: () =>
      apiClient.get<StatsResult>(
        `/stats${toQueryString({ ...(range ?? {}), pair })}`,
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
