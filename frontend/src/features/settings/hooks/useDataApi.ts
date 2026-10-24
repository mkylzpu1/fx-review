import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

/** バックアップ取得（保存はブラウザ側） */
export function useFetchBackup() {
  return useMutation({
    mutationFn: () => apiClient.get<unknown>("/backup"),
  });
}

/** 復元・全削除のあとは、すべての表示を取り直す（設定が無くなればオンボーディングへ戻る） */
export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiClient.post<{ trades: number }>("/backup/restore", body),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ deleted: true }>("/data"),
    onSuccess: () => qc.invalidateQueries(),
  });
}
