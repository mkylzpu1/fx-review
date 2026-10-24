import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type {
  ExportFormat,
  ExportRange,
  ExportResult,
  Include,
} from "../types";

/** 設定が変わるたびに生成し直す（プレビューと、コピー・ダウンロードは同じ内容） */
export function useExport(
  range: ExportRange,
  format: ExportFormat,
  include: Include,
) {
  return useQuery({
    queryKey: ["export", range, format, include],
    queryFn: () =>
      apiClient.post<ExportResult>("/export", { range, format, include }),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}
