import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { formatPips, formatR } from "@/utils/format";
import { Pagination } from "../components/Pagination";
import { TradeTable } from "../components/TradeTable";
import { useTrades, type TradeListQuery } from "../hooks/useTradesApi";
import { summarize } from "../utils/summary";
import type { TradeSort } from "../types";

const LIMIT = 20;
type ResultTab = "all" | "win" | "loss";
const TABS: { value: ResultTab; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
];
const SORTS: { value: TradeSort; label: string }[] = [
  { value: "entry_desc", label: "新しい順" },
  { value: "entry_asc", label: "古い順" },
  { value: "pnl_desc", label: "損益が大きい順" },
  { value: "pnl_asc", label: "損益が小さい順" },
];

export function TradesPage() {
  const [tab, setTab] = useState<ResultTab>("all");
  const [deviationOnly, setDeviationOnly] = useState(false);
  const [sort, setSort] = useState<TradeSort>("entry_desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // 検索は入力が止まってから反映する
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const query: TradeListQuery = {
    result: tab === "all" ? undefined : tab,
    deviationOnly,
    q: q || undefined,
    sort,
    page,
    limit: LIMIT,
  };
  const { data, isLoading, isError, refetch } = useTrades(query);
  const filtering = tab !== "all" || deviationOnly || q !== "";

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const s = summarize(data.items);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">トレード</h1>
        <div className="flex gap-2">
          <Link className="btn" to={ROUTES.TRADE_QUEUE}>
            未入力キュー
          </Link>
          <Link className="btn-primary" to={ROUTES.TRADE_NEW}>
            トレードを記録
          </Link>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="結果で絞り込み" className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.value}
                aria-pressed={tab === t.value}
                className={`btn ${tab === t.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
                onClick={() => reset(setTab)(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex min-h-touch items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deviationOnly}
              onChange={(e) => reset(setDeviationOnly)(e.target.checked)}
            />
            ルール逸脱のみ
          </label>
          <select
            aria-label="並べ替え"
            className="input w-auto font-sans"
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as TradeSort)}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="メモ・理由・気づきを検索"
            placeholder="メモ・理由・気づきを検索"
            className="input w-full font-sans sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-sm text-ink-sub">
          {data.total}件のうち、{data.items.length}件を表示
          {s.closed > 0 && (
            <>
              {" ・ "}勝率 <span className="num">{s.winRate}%</span>
              {" ・ "}合計{" "}
              <span className="num">{formatPips(s.totalPips)}</span>
              {s.avgR !== null && (
                <>
                  {" ・ "}平均 <span className="num">{formatR(s.avgR)}</span>
                </>
              )}
              {s.profitFactor !== null && (
                <>
                  {" ・ "}PF <span className="num">{s.profitFactor}</span>
                </>
              )}
              <span className="text-ink-mute">（表示中の決済済み）</span>
            </>
          )}
        </p>
      </div>

      {data.items.length === 0 ? (
        filtering ? (
          <EmptyState
            title="条件に合うトレードがありません"
            description="絞り込みを変えてみてください。"
          />
        ) : (
          <EmptyState
            title="まだトレードがありません"
            description="トレードを記録するか、CSVを取り込んでください。"
            action={
              <Link className="btn-primary" to={ROUTES.TRADE_NEW}>
                トレードを記録
              </Link>
            }
          />
        )
      ) : (
        <div className="card">
          <TradeTable trades={data.items} />
        </div>
      )}

      <Pagination
        page={page}
        limit={LIMIT}
        total={data.total}
        onChange={setPage}
      />
    </div>
  );
}
