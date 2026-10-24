import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

/** 退会（DELETE /auth/me）。成功後は保持中の表示データをすべて捨てる */
export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<{ message: string }>("/auth/me"),
    onSuccess: () => qc.clear(),
  });
}
