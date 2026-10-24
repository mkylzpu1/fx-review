import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import type { PeriodKey, StatsResult } from "../types";
import { periodFrom } from "../utils/period";

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
