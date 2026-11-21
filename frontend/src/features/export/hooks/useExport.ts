import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { CustomDateRange } from "@/features/stats/hooks/useStats";
import type { PeriodKey } from "@/features/stats/types";
import { customRange, periodRange } from "@/features/stats/utils/period";
import type { ExportFormat, ExportResult, Include } from "../types";

export type { CustomDateRange };

/** 設定が変わるたびに生成し直す（プレビューと、コピー・ダウンロードは同じ内容） */
export function useExport(
  period: PeriodKey,
  format: ExportFormat,
  include: Include,
  custom?: CustomDateRange,
) {
  const isCustom = period === "custom";
  const range = isCustom
    ? custom && customRange(custom.from, custom.to)
    : periodRange(period);
  return useQuery({
    queryKey: [
      "export",
      period,
      custom?.from ?? "",
      custom?.to ?? "",
      format,
      include,
    ],
    enabled: !isCustom || Boolean(range),
    queryFn: () =>
      apiClient.post<ExportResult>("/export", {
        ...(range ?? {}),
        format,
        include,
      }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}
