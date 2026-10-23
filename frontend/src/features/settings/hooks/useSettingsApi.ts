import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/services/apiClient";
import type { AccountSettings, CurrencyPair, Tag, TagKind } from "../types";

export const settingsKeys = {
  settings: ["settings"] as const,
  pairs: ["currency-pairs"] as const,
  tags: ["tags"] as const,
};

/** 設定。未作成（404）はエラーにせず null を返す（オンボーディング判定用） */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.settings,
    retry: false,
    queryFn: async (): Promise<AccountSettings | null> => {
      try {
        return await apiClient.get<AccountSettings>("/settings");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
}

/** 設定の作成・更新（初回は balanceJpy 必須） */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AccountSettings>) =>
      apiClient.put<AccountSettings>("/settings", patch),
    onSuccess: (data) => {
      qc.setQueryData(settingsKeys.settings, data);
      // 初回作成時はペア・タグも投入されるため取り直す
      void qc.invalidateQueries({ queryKey: settingsKeys.pairs });
      void qc.invalidateQueries({ queryKey: settingsKeys.tags });
    },
  });
}

export function usePairs() {
  return useQuery({
    queryKey: settingsKeys.pairs,
    queryFn: async () =>
      (await apiClient.get<{ items: CurrencyPair[] }>("/currency-pairs")).items,
  });
}

export function useTags() {
  return useQuery({
    queryKey: settingsKeys.tags,
    queryFn: async () => (await apiClient.get<{ items: Tag[] }>("/tags")).items,
  });
}

export function useCreatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<CurrencyPair, "id">) =>
      apiClient.post<CurrencyPair>("/currency-pairs", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.pairs }),
  });
}

export function useUpdatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<CurrencyPair> & { id: string }) =>
      apiClient.put<CurrencyPair>(`/currency-pairs/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.pairs }),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { kind: TagKind; name: string }) =>
      apiClient.post<Tag>("/tags", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.tags }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ id: string }>(`/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.tags }),
  });
}
