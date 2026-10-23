import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { SIDE_LABEL, formatJst } from "@/utils/format";
import { MissingBadges } from "../components/MissingBadges";
import { Pagination } from "../components/Pagination";
import { useQueue, useQueueCounts } from "../hooks/useTradesApi";
import type { QueueFilter } from "../types";

const LIMIT = 20;
const CHIPS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "sl_tp", label: "SL・TP未入力" },
  { value: "no_rationale", label: "根拠なし" },
  { value: "open", label: "未決済" },
];

const editPath = (id: string) => ROUTES.TRADE_EDIT.replace(":id", id);

/** 取り込み後などに、書き足したいトレードを1件ずつ開くための画面（入力は任意） */
export function TradeQueuePage() {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQueue(filter, page, LIMIT);
  const counts = useQueueCounts();

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const first = data.items[0];
  const progress =
    data.totalCount === 0
      ? 0
      : Math.round((data.filledCount / data.totalCount) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">未入力のトレード</h1>
          <p className="mt-1 text-sm text-ink-sub">
            取り込み後に書き足したいトレードが
            <span className="num">{data.pendingCount}</span>
            件あります。入力は任意です。
          </p>
        </div>
        {first && (
          <Link className="btn-primary" to={editPath(first.id)}>
            新しい順に1件ずつ開く
          </Link>
        )}
      </div>

      <div className="card space-y-2">
        <p className="text-sm">
          入力の進み具合{" "}
          <span className="num font-medium">
            {data.filledCount} / {data.totalCount}件
          </span>
        </p>
        <div
          role="progressbar"
          aria-label="入力の進み具合"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 overflow-hidden rounded-full bg-surface"
        >
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div
        role="group"
        aria-label="未入力の種類で絞り込み"
        className="flex flex-wrap gap-2"
      >
        {CHIPS.map((c) => (
          <button
            key={c.value}
            aria-pressed={filter === c.value}
            className={`btn ${filter === c.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
            onClick={() => {
              setFilter(c.value);
              setPage(1);
            }}
          >
            {c.label}
            {counts[c.value] !== undefined && (
              <span className="num ml-2 text-ink-sub">{counts[c.value]}</span>
            )}
          </button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          title={
            filter === "all"
              ? "入力のないトレードはありません"
              : "この条件に当てはまるトレードはありません"
          }
          description="トレードの一覧から、いつでも見返せます。"
          action={
            <Link className="btn" to={ROUTES.TRADES}>
              トレード一覧へ
            </Link>
          }
        />
      ) : (
        <ul className="card divide-y divide-line p-0">
          {data.items.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-3 px-6 py-3"
            >
              <span className="num text-sm">{formatJst(t.entryAt)}</span>
              <span className="text-sm">
                {t.pair} {SIDE_LABEL[t.side]}
              </span>
              <span className="flex-1">
                <MissingBadges missing={t.missing} />
              </span>
              <Link className="btn" to={editPath(t.id)}>
                開く
              </Link>
            </li>
          ))}
        </ul>
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
