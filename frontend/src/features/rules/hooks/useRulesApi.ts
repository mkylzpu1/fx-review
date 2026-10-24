import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { Rule, RuleDetail, RuleInput } from "../types";

export const ruleKeys = { all: ["rules"] as const };

export function useRules() {
  return useQuery({
    queryKey: ruleKeys.all,
    queryFn: async () =>
      (await apiClient.get<{ items: Rule[] }>("/rules")).items,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RuleInput) => apiClient.post<Rule>("/rules", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Rule> & { id: string }) =>
      apiClient.put<Rule>(`/rules/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ruleKeys.all });
      // 判定結果（逸脱）が変わるため、トレード側の表示も取り直す
      void qc.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useRuleDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...ruleKeys.all, "detail", id ?? ""] as const,
    queryFn: () => apiClient.get<RuleDetail>(`/rules/${id}`),
    enabled: Boolean(id),
  });
}
