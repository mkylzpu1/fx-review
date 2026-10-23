import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type {
  Page,
  QueueFilter,
  QueueResult,
  Trade,
  TradePayload,
  TradeSort,
} from "../types";

export interface TradeListQuery {
  result?: "win" | "loss";
  deviationOnly?: boolean;
  q?: string;
  pair?: string;
  pending?: boolean;
  sort?: TradeSort;
  page?: number;
  limit?: number;
}

export const tradeKeys = {
  all: ["trades"] as const,
  list: (q: TradeListQuery) => ["trades", "list", q] as const,
  queue: (f: QueueFilter, page: number) =>
    ["trades", "queue", f, page] as const,
  detail: (id: string) => ["trades", "detail", id] as const,
};

/** 値があるものだけクエリ文字列にする */
export function toQueryString(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useTrades(q: TradeListQuery) {
  return useQuery({
    queryKey: tradeKeys.list(q),
    queryFn: () => apiClient.get<Page<Trade>>(`/trades${toQueryString(q)}`),
    placeholderData: keepPreviousData,
  });
}

export function useQueue(filter: QueueFilter, page: number, limit = 20) {
  return useQuery({
    queryKey: tradeKeys.queue(filter, page),
    queryFn: () =>
      apiClient.get<QueueResult>(
        `/trades/queue${toQueryString({ filter, page, limit })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useTrade(id: string | undefined) {
  return useQuery({
    queryKey: tradeKeys.detail(id ?? ""),
    queryFn: () => apiClient.get<Trade>(`/trades/${id}`),
    enabled: !!id,
  });
}

export function useSaveTrade(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TradePayload) =>
      id
        ? apiClient.put<Trade>(`/trades/${id}`, payload)
        : apiClient.post<Trade>("/trades", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ id: string }>(`/trades/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}

export function useRestoreTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Trade>(`/trades/${id}/restore`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradeKeys.all }),
  });
}

/**
 * 「保存して次の未入力へ」用。保存する前に、新しい順の未入力キューから
 * 現在のトレードの次のIDを求める（保存後はキューから外れることがあるため）。
 */
export async function findNextUnfilledId(
  qc: QueryClient,
  currentId: string,
): Promise<string | null> {
  const queue = await qc.fetchQuery({
    queryKey: ["trades", "queue-next"],
    queryFn: () =>
      apiClient.get<QueueResult>(
        `/trades/queue${toQueryString({ filter: "all", limit: 100 })}`,
      ),
    staleTime: 0,
  });
  const ids = queue.items.map((t) => t.id);
  const i = ids.indexOf(currentId);
  const next = i >= 0 ? ids[i + 1] : ids[0];
  return next ?? ids.find((id) => id !== currentId) ?? null;
}

const QUEUE_FILTERS: QueueFilter[] = ["all", "sl_tp", "no_rationale", "open"];

/** キューの絞り込みごとの件数（件数だけ欲しいので1件だけ取得する） */
export function useQueueCounts() {
  const results = useQueries({
    queries: QUEUE_FILTERS.map((f) => ({
      queryKey: ["trades", "queue-count", f],
      queryFn: () =>
        apiClient.get<QueueResult>(
          `/trades/queue${toQueryString({ filter: f, limit: 1 })}`,
        ),
    })),
  });
  const counts: Partial<Record<QueueFilter, number>> = {};
  QUEUE_FILTERS.forEach((f, i) => {
    const total = results[i].data?.total;
    if (total !== undefined) counts[f] = total;
  });
  return counts;
}
