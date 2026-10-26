import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { tradeKeys } from "@/features/trades/hooks/useTradesApi";
import type {
  CommitResult,
  DuplicateMode,
  ImportFileInput,
  OrderLinkCommit,
  OrderLinkPreview,
  PreviewResult,
} from "../types";

export function useImportPreview() {
  return useMutation({
    mutationFn: (files: ImportFileInput[]) =>
      apiClient.post<PreviewResult | OrderLinkPreview>("/imports/preview", {
        files,
      }),
  });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      files: ImportFileInput[];
      duplicateMode: DuplicateMode;
    }) => apiClient.post<CommitResult | OrderLinkCommit>("/imports/commit", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}
