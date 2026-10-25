import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { usePairs } from "@/features/settings/hooks/useSettingsApi";
import { PERIODS, periodFrom } from "@/features/stats/utils/period";
import type { PeriodKey } from "@/features/stats/types";
import { formatPips, formatR } from "@/utils/format";
import { CandleSyncButton } from "../components/CandleSyncButton";
import { Pagination } from "../components/Pagination";
import { TradeTable } from "../components/TradeTable";
import {
  useQueue,
  useTrades,
  type TradeListQuery,
} from "../hooks/useTradesApi";
import { summarize } from "../utils/summary";
import type { TradeSort } from "../types";

const LIMIT = 20;
/** 集計に使う件数の上限（APIの1回あたりの最大） */
const STATS_LIMIT = 100;
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

/** 下線で選ぶ切り替え（枠やピルは使わない） */
function Underline<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-5">
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`-mb-px border-b-2 py-2 text-sm transition-colors ${
            value === o.value
              ? "border-accent-link text-ink"
              : "border-transparent text-ink-mute hover:text-ink-sub"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-xs text-ink-mute">{label}</p>
      <p className={`num mt-1 text-3xl font-medium ${tone ?? "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

export function TradesPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [tab, setTab] = useState<ResultTab>("all");
  const [pair, setPair] = useState("");
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

  const pairs = usePairs();
  const counts = useQueue("all", 1, 1);

  const filters: TradeListQuery = {
    result: tab === "all" ? undefined : tab,
    deviationOnly,
    q: q || undefined,
    pair: pair || undefined,
    from: periodFrom(period),
  };
  const query: TradeListQuery = { ...filters, sort, page, limit: LIMIT };
  const { data, isLoading, isError, refetch } = useTrades(query);
  // 統計は表示ページではなく、絞り込み後の全体（上限100件）で出す
  const all = useTrades({
    ...filters,
    sort: "entry_desc",
    page: 1,
    limit: STATS_LIMIT,
  });
  const filtering =
    tab !== "all" ||
    deviationOnly ||
    q !== "" ||
    pair !== "" ||
    period !== "all";

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const s = summarize(all.data?.items ?? data.items);
  const capped = (all.data?.total ?? 0) > STATS_LIMIT;
  const queue = counts.data;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">トレード</h1>
          <p className="mt-1 text-sm text-ink-mute">
            <span className="num">{data.total}</span>件
            {filtering ? "（絞り込み中）" : ""}
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link
            className="text-ink-sub hover:text-ink"
            to={ROUTES.TRADE_IMPORT}
          >
            CSVを取り込む
          </Link>
          <Link className="btn-primary" to={ROUTES.TRADE_NEW}>
            トレードを記録
          </Link>
        </div>
      </div>

      {/* 集計: 枠なし。大きな数字を横に並べるだけ */}
      <section
        aria-label="集計"
        className="mt-10 flex flex-wrap items-end gap-x-16 gap-y-6"
      >
        <Figure
          label="合計"
          value={s.closed > 0 ? formatPips(s.totalPips) : "—"}
          tone={
            s.totalPips > 0
              ? "text-profit"
              : s.totalPips < 0
                ? "text-loss"
                : undefined
          }
        />
        <Figure
          label="勝率"
          value={s.winRate === null ? "—" : `${s.winRate}%`}
        />
        <Figure
          label="プロフィットファクター"
          value={s.profitFactor === null ? "—" : String(s.profitFactor)}
        />
        <Figure label="平均R" value={formatR(s.avgR)} />
        {queue && queue.pendingCount > 0 && (
          <Link
            to={ROUTES.TRADE_QUEUE}
            className="group ml-auto text-right text-sm"
          >
            <span className="block text-xs text-ink-mute">
              入力済み{" "}
              <span className="num">
                {queue.filledCount}/{queue.totalCount}
              </span>
            </span>
            <span className="mt-1 block text-ink-sub underline-offset-4 group-hover:text-ink group-hover:underline">
              未入力 <span className="num">{queue.pendingCount}</span>
              件を入力する →
            </span>
          </Link>
        )}
      </section>
      <p className="mt-3 text-xs text-ink-mute">
        {s.closed}件の決済済みを集計
        {capped ? `（新しい${STATS_LIMIT}件まで）` : ""}
      </p>

      {/* 絞り込み: 罫線の上に文字だけ */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-line">
        <div className="flex flex-wrap items-center gap-x-10">
          <Underline
            label="期間"
            value={period}
            options={PERIODS}
            onChange={reset(setPeriod)}
          />
          <Underline
            label="結果で絞り込み"
            value={tab}
            options={TABS}
            onChange={reset(setTab)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 pb-2 text-sm">
          <select
            aria-label="通貨ペア"
            className="bg-transparent text-ink-sub hover:text-ink"
            value={pair}
            onChange={(e) => reset(setPair)(e.target.value)}
          >
            <option value="">全ペア</option>
            {(pairs.data ?? []).map((p) => (
              <option key={p.id} value={p.symbol}>
                {p.symbol}
              </option>
            ))}
          </select>
          <select
            aria-label="並べ替え"
            className="bg-transparent text-ink-sub hover:text-ink"
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as TradeSort)}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-ink-sub">
            <input
              type="checkbox"
              className="accent-[#3E63DD]"
              checked={deviationOnly}
              onChange={(e) => reset(setDeviationOnly)(e.target.checked)}
            />
            ルール逸脱のみ
          </label>
          <input
            type="search"
            aria-label="メモ・理由・気づきを検索"
            placeholder="メモ・理由・気づきを検索"
            className="w-56 border-0 border-b border-field bg-transparent py-1 text-sm text-ink placeholder:text-ink-mute focus:border-accent-link focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="mt-8">
          {filtering ? (
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
          )}
        </div>
      ) : (
        <>
          <p className="sr-only">
            {data.total}件のうち、{data.items.length}件を表示
          </p>
          <TradeTable trades={data.items} />
        </>
      )}

      <div className="mt-8">
        <Pagination
          page={page}
          limit={LIMIT}
          total={data.total}
          onChange={setPage}
        />
      </div>

      <div className="mt-16 border-t border-line pt-4">
        <CandleSyncButton />
      </div>
    </div>
  );
}
