import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { tradeKeys } from "@/features/trades/hooks/useTradesApi";
import type {
  CommitResult,
  DuplicateMode,
  ImportFileInput,
  PreviewResult,
} from "../types";

export function useImportPreview() {
  return useMutation({
    mutationFn: (files: ImportFileInput[]) =>
      apiClient.post<PreviewResult>("/imports/preview", { files }),
  });
}

export function useImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      files: ImportFileInput[];
      duplicateMode: DuplicateMode;
    }) => apiClient.post<CommitResult>("/imports/commit", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}
