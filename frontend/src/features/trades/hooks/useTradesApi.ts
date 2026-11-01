import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { periodFrom } from "@/features/stats/utils/period";
import { dateRangeToIso, loadListPrefs } from "../utils/tradeListPrefs";
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
  /** エントリー日時の上限（ISO日時・含む） */
  to?: string;
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
/** 残りのページを同時に取りに行く数（DBの接続を使い切らないための上限） */
const ALL_CONCURRENCY = 4;

/**
 * 絞り込み条件に合う全件を、ページをたどって取得する（集計用）。
 * 統計画面と同じ母集団で合計を出すため、先頭の100件で打ち切らない。
 * 1ページ目で総件数が分かるので、残りは1ページずつ待たずに、まとめて同時に取りに行く。
 */
export function useAllTrades(
  q: Omit<TradeListQuery, "page" | "limit" | "sort">,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["trades", "all", q] as const,
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const fetchPage = (page: number) =>
        apiClient.get<Page<Trade>>(
          `/trades${toQueryString({ ...q, sort: "entry_desc", page, limit: ALL_PAGE_LIMIT })}`,
        );
      const first = await fetchPage(1);
      const items: Trade[] = [...first.items];
      const pageCount = Math.min(
        ALL_MAX_PAGES,
        Math.ceil(first.total / ALL_PAGE_LIMIT),
      );
      for (let from = 2; from <= pageCount; from += ALL_CONCURRENCY) {
        const pages = Array.from(
          { length: Math.min(ALL_CONCURRENCY, pageCount - from + 1) },
          (_, i) => from + i,
        );
        const rest = await Promise.all(pages.map(fetchPage));
        for (const r of rest) items.push(...r.items);
      }
      return { items, total: first.total };
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

export type NextInList =
  | { kind: "next"; id: string }
  /** 一覧の最後のトレードだった */
  | { kind: "last" };

/** 一覧を次のページへたどる上限（無限ループ防止。100件×50ページ=5,000件） */
const NEXT_MAX_PAGES = 50;

/**
 * 「保存して次のトレードへ」用。/trades で選んでいる絞り込み・並び順（前回の保存値）と同じ条件で
 * 一覧を取り、いま開いているトレードの次のIDを返す。保存で並びや絞り込みの結果が変わることがあるため、
 * 保存する前に求めておく。一覧に今のトレードが無いとき（直接開いた・絞り込みから外れている）は先頭から始める。
 * 検索ワードは保存していないので使わない。
 */
export async function findNextInList(
  qc: QueryClient,
  currentId: string,
  knownPairs: string[],
): Promise<NextInList> {
  const prefs = loadListPrefs();
  // 設定から消えたペアは一覧と同じく「すべて」として扱う
  const pair = knownPairs.includes(prefs.pair) ? prefs.pair : "";
  // 日付で期間を指定していれば、一覧と同じくそちらを優先する
  const custom = dateRangeToIso(prefs.dateFrom, prefs.dateTo);
  const useCustom = prefs.dateFrom !== "" || prefs.dateTo !== "";
  const filters: TradeListQuery = {
    result: prefs.tab === "all" ? undefined : prefs.tab,
    deviationOnly: prefs.deviationOnly,
    pair: pair || undefined,
    from: useCustom ? custom.from : periodFrom(prefs.period),
    to: useCustom ? custom.to : undefined,
    sort: prefs.sort,
    limit: 100,
  };
  const ids: string[] = [];
  for (let page = 1; page <= NEXT_MAX_PAGES; page++) {
    const res = await qc.fetchQuery({
      queryKey: ["trades", "list-next", { ...filters, page }],
      queryFn: () =>
        apiClient.get<Page<Trade>>(
          `/trades${toQueryString({ ...filters, page })}`,
        ),
      staleTime: 0,
    });
    ids.push(...res.items.map((t) => t.id));
    const i = ids.indexOf(currentId);
    // 今のトレードの次まで取れたら終わり
    if (i >= 0 && ids.length > i + 1) return { kind: "next", id: ids[i + 1] };
    if (ids.length >= res.total || res.items.length === 0) {
      if (i >= 0) return { kind: "last" };
      const first = ids.find((id) => id !== currentId);
      return first ? { kind: "next", id: first } : { kind: "last" };
    }
  }
  return { kind: "last" };
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
