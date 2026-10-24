import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import type {
  WeeklyResult,
  WeeklyReviewSaved,
  WeeklySaveBody,
} from "../weeklyTypes";

/** weekStart を省くと今週 */
export function useWeekly(weekStart: string | undefined) {
  return useQuery({
    queryKey: ["weekly", weekStart ?? "current"],
    queryFn: () =>
      apiClient.get<WeeklyResult>(
        `/weekly-review${toQueryString({ weekStart })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSaveWeekly(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WeeklySaveBody) =>
      apiClient.put<WeeklyReviewSaved>(
        `/weekly-review${toQueryString({ weekStart })}`,
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly"] }),
  });
}
