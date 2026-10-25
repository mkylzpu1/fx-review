import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { usePairs } from "@/features/settings/hooks/useSettingsApi";
import { PERIODS, periodFrom } from "@/features/stats/utils/period";
import type { PeriodKey } from "@/features/stats/types";
import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import { CandleSyncButton } from "../components/CandleSyncButton";
import { Pagination } from "../components/Pagination";
import type { MiniTf } from "../components/MiniChart";
import { TradeTable } from "../components/TradeTable";
import {
  useQueue,
  useAllTrades,
  useTrades,
  type TradeListQuery,
} from "../hooks/useTradesApi";
import { summarize } from "../utils/summary";
import type { Trade, TradeSort } from "../types";

const LIMIT = 20;
type ResultTab = "all" | "win" | "loss";
const TABS: { value: ResultTab; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
];
const TF_OPTIONS: { value: MiniTf; label: string }[] = [
  { value: "auto", label: "自動" },
  { value: "1m", label: "1分" },
  { value: "5m", label: "5分" },
  { value: "15m", label: "15分" },
  { value: "1h", label: "1時間" },
  { value: "4h", label: "4時間" },
  { value: "1d", label: "日足" },
];
const TF_KEY = "fx-review:trade-list-tf";
const loadTf = (): MiniTf => {
  try {
    const v = localStorage.getItem(TF_KEY);
    return TF_OPTIONS.some((o) => o.value === v) ? (v as MiniTf) : "auto";
  } catch {
    return "auto";
  }
};
const SORTS: { value: TradeSort; label: string }[] = [
  { value: "entry_desc", label: "新しい順" },
  { value: "entry_asc", label: "古い順" },
  { value: "pnl_desc", label: "損益が大きい順" },
  { value: "pnl_asc", label: "損益が小さい順" },
];

/** 枠つきの切り替え（セグメント） */
function Seg<T extends string>({
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
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[10px] border border-line bg-card p-[3px]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 items-center rounded-[7px] px-3 text-[13px] transition-colors ${
            value === o.value
              ? "bg-accent/[.22] font-medium text-[#C9D6FF]"
              : "text-ink-sub hover:bg-surface"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const selectCls =
  "h-[38px] appearance-none rounded-chip border border-field bg-transparent pl-3.5 pr-8 text-[13px] text-ink-sub hover:bg-surface [&>option]:bg-card [&>option]:text-ink";

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute right-3"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8B95A5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** 累積損益の小さな波形（決済済みを古い順に積み上げる） */
function PnlSpark({ trades }: { trades: Trade[] }) {
  const done = trades
    .filter((t) => t.pnlJpy !== null)
    .sort((a, b) => Date.parse(a.entryAt) - Date.parse(b.entryAt));
  if (done.length < 2) return null;
  let acc = 0;
  const cum = done.map((t) => (acc += t.pnlJpy ?? 0));
  const W = 120;
  const H = 40;
  const hi = Math.max(...cum);
  const lo = Math.min(...cum);
  const pts = cum.map(
    (v, i) =>
      `${((i / (cum.length - 1)) * W).toFixed(1)},${(3 + ((hi - v) / Math.max(1e-9, hi - lo)) * (H - 8)).toFixed(1)}`,
  );
  const up = cum[cum.length - 1] >= 0;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      className="absolute bottom-5 right-6"
    >
      <polygon
        points={`0,${H} ${pts.join(" ")} ${W},${H}`}
        fill={up ? "rgba(110,231,200,.12)" : "rgba(255,122,138,.12)"}
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={up ? "#6EE7C8" : "#FF7A8A"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const toneOf = (v: number | null | undefined) =>
  !v ? "text-ink" : v > 0 ? "text-profit" : "text-loss";

export function TradesPage() {
  // 統計画面と同じ既定の期間にして、合計がそろうようにする
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [tab, setTab] = useState<ResultTab>("all");
  const [pair, setPair] = useState("");
  const [deviationOnly, setDeviationOnly] = useState(false);
  const [sort, setSort] = useState<TradeSort>("entry_desc");
  const [page, setPage] = useState(1);
  const [tf, setTfState] = useState<MiniTf>(loadTf);
  const setTf = (v: MiniTf) => {
    setTfState(v);
    try {
      localStorage.setItem(TF_KEY, v);
    } catch {
      /* 保存できなくても表示には影響しない */
    }
  };
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
  // 集計は表示ページではなく、絞り込み後の全件で出す（統計画面と同じ母集団）
  const all = useAllTrades(filters);
  const filtering =
    tab !== "all" ||
    deviationOnly ||
    q !== "" ||
    pair !== "" ||
    period !== "90d";

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const s = summarize(all.data?.items ?? data.items);
  const queue = counts.data;

  const items = all.data?.items ?? data.items;
  const winPct = s.winRate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[26px] font-bold tracking-[.01em]">トレード</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            label="期間"
            value={period}
            options={PERIODS}
            onChange={reset(setPeriod)}
          />
          <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-line" />
          <CandleSyncButton variant="header" />
          <Link
            className="btn border-transparent text-ink-sub hover:text-ink"
            to={ROUTES.TRADE_IMPORT}
          >
            CSVを取り込む
          </Link>
          <Link className="btn-primary" to={ROUTES.TRADE_NEW}>
            トレードを記録
          </Link>
        </div>
      </div>

      {/* 指標: 絞り込み後の全体で集計して、いちばん上に置く */}
      <section
        aria-label="集計"
        className="grid overflow-hidden rounded-card border border-line bg-card md:grid-cols-[1.35fr_1fr_1fr_1.5fr]"
      >
        <div className="relative px-6 pb-[22px] pt-5">
          <p className="text-xs text-ink-mute">
            損益
            <span className="ml-1.5">全{all.data?.total ?? data.total}件</span>
          </p>
          <p
            className={`num mt-2 text-[32px] font-medium leading-[1.1] ${toneOf(s.closed > 0 ? s.totalJpy : null)}`}
          >
            {s.closed > 0 ? formatYenSigned(s.totalJpy) : "—"}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            {s.closed > 0 ? formatPips(s.totalPips) : "—"}
          </p>
          <PnlSpark trades={items} />
        </div>
        <div className="border-t border-line px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          <p className="text-xs text-ink-mute">勝率</p>
          <p className="num mt-2 text-[32px] font-medium leading-[1.1]">
            {s.winRate === null ? (
              "—"
            ) : (
              <>
                {s.winRate}
                <span className="text-xl">%</span>
              </>
            )}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            {s.wins}勝 {s.losses}敗
          </p>
          {s.winRate !== null && (
            <div aria-hidden="true" className="mt-2.5 flex gap-[3px]">
              <span
                className="h-[5px] rounded-[3px] bg-profit"
                style={{ width: `${winPct}%` }}
              />
              <span
                className="h-[5px] rounded-[3px] bg-loss"
                style={{ width: `${100 - winPct}%` }}
              />
            </div>
          )}
        </div>
        <div className="border-t border-line px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          <p className="text-xs text-ink-mute">平均R</p>
          <p className="num mt-2 text-[32px] font-medium leading-[1.1]">
            {formatR(s.avgR)}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            PF {s.profitFactor === null ? "—" : s.profitFactor}
          </p>
        </div>
        <div className="border-t border-line bg-accent/10 px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          {queue && queue.pendingCount > 0 ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#B7C8FF]">入力の進捗</p>
                  <p className="num mt-2 text-[32px] font-medium leading-[1.1]">
                    {queue.filledCount}
                    <span className="text-xl text-ink-mute">
                      /{queue.totalCount}件
                    </span>
                  </p>
                </div>
                <Link
                  to={ROUTES.TRADE_QUEUE}
                  className="btn h-9 min-h-0 border-[#5D78D6] px-3 text-[13px] text-[#B7C8FF] hover:bg-accent/15"
                >
                  未入力を埋める →
                </Link>
              </div>
              <div
                aria-hidden="true"
                className="mt-3 h-1.5 rounded-[3px] bg-line"
              >
                <div
                  className="h-1.5 rounded-[3px] bg-accent-link"
                  style={{
                    width: `${queue.totalCount === 0 ? 0 : (queue.filledCount / queue.totalCount) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-2.5 text-[13px] text-ink-sub">
                未入力 <span className="num">{queue.pendingCount}</span>件
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-[#B7C8FF]">入力の進捗</p>
              <p className="mt-2 text-sm text-ink-sub">
                未入力のトレードはありません
              </p>
            </>
          )}
        </div>
      </section>
      <p className="-mt-3 text-xs text-ink-mute">
        {s.closed}件の決済済みを集計（統計画面と同じ条件）
        {filtering ? " ・ 絞り込み中" : ""}
      </p>

      {/* 絞り込み: 1行にまとめる。時間足は一覧の全チャートに効く */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Seg
          label="結果で絞り込み"
          value={tab}
          options={TABS}
          onChange={reset(setTab)}
        />
        <button
          type="button"
          aria-pressed={deviationOnly}
          onClick={() => reset(setDeviationOnly)(!deviationOnly)}
          className={`inline-flex h-[38px] items-center gap-2 rounded-chip border px-3.5 text-[13px] ${
            deviationOnly
              ? "border-caution bg-caution/10 text-caution"
              : "border-field text-ink-sub hover:bg-surface"
          }`}
        >
          ルール逸脱のみ
        </button>
        <label className="relative inline-flex items-center">
          <select
            aria-label="通貨ペア"
            className={selectCls}
            value={pair}
            onChange={(e) => reset(setPair)(e.target.value)}
          >
            <option value="">ペア：すべて</option>
            {(pairs.data ?? []).map((p) => (
              <option key={p.id} value={p.symbol}>
                {p.symbol}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
        <label className="relative inline-flex items-center">
          <select
            aria-label="並べ替え"
            className={selectCls}
            value={sort}
            onChange={(e) => reset(setSort)(e.target.value as TradeSort)}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Chevron />
        </label>
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
        <span className="text-xs text-ink-mute">チャートの時間足</span>
        <Seg
          label="チャートの時間足"
          value={tf}
          options={TF_OPTIONS}
          onChange={setTf}
        />
        <div className="flex-1" />
        <input
          type="search"
          aria-label="メモ・理由・気づきを検索"
          placeholder="メモ・理由・気づきを検索"
          className="h-[38px] w-[300px] rounded-chip border border-field bg-bg px-3.5 text-[13px] text-ink placeholder:text-ink-mute"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {data.items.length === 0 ? (
        <div>
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
          <TradeTable trades={data.items} tf={tf} />
        </>
      )}

      <div>
        <Pagination
          page={page}
          limit={LIMIT}
          total={data.total}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
