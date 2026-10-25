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
  from?: string;
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

/** 1回の取得上限（API側の最大） */
const ALL_PAGE_LIMIT = 100;
/** 集計用に取りに行く最大ページ数（無限ループ防止。100件×50ページ=5,000件） */
const ALL_MAX_PAGES = 50;

/**
 * 絞り込み条件に合う全件を、ページをたどって取得する（集計用）。
 * 統計画面と同じ母集団で合計を出すため、先頭の100件で打ち切らない。
 */
export function useAllTrades(
  q: Omit<TradeListQuery, "page" | "limit" | "sort">,
) {
  return useQuery({
    queryKey: ["trades", "all", q] as const,
    queryFn: async () => {
      const items: Trade[] = [];
      let total = 0;
      for (let page = 1; page <= ALL_MAX_PAGES; page++) {
        const r = await apiClient.get<Page<Trade>>(
          `/trades${toQueryString({ ...q, sort: "entry_desc", page, limit: ALL_PAGE_LIMIT })}`,
        );
        items.push(...r.items);
        total = r.total;
        if (r.items.length === 0 || items.length >= r.total) break;
      }
      return { items, total };
    },
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

const byTime = (a: Trade, b: Trade) =>
  Date.parse(a.entryAt) - Date.parse(b.entryAt) || a.id.localeCompare(b.id);

/**
 * 時系列で前（古い）・次（新しい）のトレード。
 * 同じ時刻のトレードがあっても順序が決まるよう、（エントリー時刻, id）の順で並べる。
 * 取得した前後のトレードは詳細のキャッシュにも入れて、移動をすぐ表示できるようにする
 */
export function useAdjacentTrades(trade: Trade | undefined) {
  const qc = useQueryClient();
  const entryAt = trade?.entryAt;
  const older = useQuery({
    queryKey: ["trades", "adjacent", "older", trade?.id, entryAt],
    queryFn: () =>
      apiClient.get<Page<Trade>>(
        `/trades${toQueryString({ to: entryAt, sort: "entry_desc", limit: 10 })}`,
      ),
    enabled: !!trade,
  });
  const newer = useQuery({
    queryKey: ["trades", "adjacent", "newer", trade?.id, entryAt],
    queryFn: () =>
      apiClient.get<Page<Trade>>(
        `/trades${toQueryString({ from: entryAt, sort: "entry_asc", limit: 10 })}`,
      ),
    enabled: !!trade,
  });

  const all = new Map<string, Trade>();
  for (const t of [...(older.data?.items ?? []), ...(newer.data?.items ?? [])])
    all.set(t.id, t);
  const sorted = [...all.values()].sort(byTime);
  const i = trade ? sorted.findIndex((t) => t.id === trade.id) : -1;
  const prev = i > 0 ? sorted[i - 1] : null;
  const next = i >= 0 && i < sorted.length - 1 ? sorted[i + 1] : null;

  for (const n of [prev, next]) {
    if (n && !qc.getQueryData(tradeKeys.detail(n.id)))
      qc.setQueryData(tradeKeys.detail(n.id), n);
  }
  return { prev, next, isLoading: older.isLoading || newer.isLoading };
}
