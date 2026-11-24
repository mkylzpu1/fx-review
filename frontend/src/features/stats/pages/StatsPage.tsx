import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { InfoTip } from "@/components/common/InfoTip";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { formatR } from "@/utils/format";
import { CumulativeChart } from "../components/CumulativeChart";
import { DailyGrowthChart } from "../components/DailyGrowthChart";
import { GroupTable } from "../components/GroupTable";
import { InsightList } from "../components/InsightList";
import { RHistogramChart } from "../components/RHistogramChart";
import { PeriodCompare } from "../components/PeriodCompare";
import {
  type CustomDateRange,
  usePreviousStats,
  useStats,
} from "../hooks/useStats";
import type { PeriodKey } from "../types";
import { PERIODS } from "../utils/period";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 「期間を指定」の初期値：今日を終了日、7日前を開始日にする */
function defaultCustomRange(): CustomDateRange {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line p-3">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="num text-lg font-bold">{value}</p>
      {note && <p className="text-xs text-ink-mute">{note}</p>}
    </div>
  );
}

/** 統計。R系はRが計算できるトレードだけ、勝率・pips・円は全件（SLは任意項目のため） */
export function StatsPage() {
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [customRange, setCustomRange] = useState<CustomDateRange>(
    defaultCustomRange,
  );
  const { data, isLoading, isError, refetch } = useStats(
    period,
    undefined,
    customRange,
  );
  const prevStats = usePreviousStats(period);

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;
  const s = data.summary;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">統計</h1>

      <div role="group" aria-label="期間" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={`btn ${period === p.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input"
            aria-label="開始日"
            value={customRange.from}
            max={customRange.to}
            onChange={(e) =>
              setCustomRange((r) => ({ ...r, from: e.target.value }))
            }
          />
          <span className="text-sm text-ink-mute">〜</span>
          <input
            type="date"
            className="input"
            aria-label="終了日"
            value={customRange.to}
            min={customRange.from}
            onChange={(e) =>
              setCustomRange((r) => ({ ...r, to: e.target.value }))
            }
          />
        </div>
      )}

      {data.closedCount > 0 && (
        <PeriodCompare
          now={s}
          prev={
            prevStats.data && prevStats.data.closedCount > 0
              ? prevStats.data.summary
              : null
          }
          periodLabel={
            PERIODS.find((p) => p.value === period)?.label ?? period
          }
        />
      )}

      {data.closedCount === 0 ? (
        <EmptyState
          title="まだ集計できるトレードがありません"
          description="決済済みのトレードを記録するか、約定履歴のCSVを取り込むと、ここに統計が出ます。"
          action={
            <Link className="btn-primary" to={ROUTES.TRADE_IMPORT}>
              CSVを取り込む
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="勝率"
              value={s.winRate === null ? "—" : `${s.winRate.toFixed(1)}%`}
              note={`n=${s.n}`}
            />
            <Metric
              label="PF"
              value={s.profitFactor === null ? "—" : s.profitFactor.toFixed(2)}
              note={`R計算 n=${s.rCount}`}
            />
            <Metric
              label="平均R"
              value={formatR(s.avgR)}
              note={`R計算 n=${s.rCount}`}
            />
            <Metric label="最大連敗" value={`${s.maxLossStreak}連敗`} />
          </div>

          <InsightList insights={data.insights} summary={s} />

          <div className="grid gap-4 sm:grid-cols-2">
            {(data.daily ?? []).length > 0 && (
              <>
                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    損益
                    <InfoTip label="日々の成長（損益）とは">
                      取引のあった日ごとの成績です。上の折れ線は「その日までの合計」、
                      下の棒は「その日だけの成績」です。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart daily={data.daily ?? []} metric="pnl" />
                </section>

                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    pips
                    <InfoTip label="日々の成長（pips）とは">
                      取引のあった日ごとの成績です。上の折れ線は「その日までの合計」、
                      下の棒は「その日だけの成績」です。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart daily={data.daily ?? []} metric="pips" />
                </section>
              </>
            )}

            <section className="card min-w-0 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-bold">
                累積R
                <InfoTip label="累積Rとは">
                  R
                  は「最初に決めた損切り幅（エントリーからSLまで）を1とした、損益の倍率」です。
                  SLまで20pipsで+40pips勝てば +2R、SLに掛かれば −1R。
                  累積Rは、これを古い順に足し合わせたものです。
                  ロットや通貨ペアが違っても、同じ物差しで成長を比べられます。
                  SLを入れていないトレードは計算に入りません。
                </InfoTip>
              </h2>
              <p className="text-xs text-ink-mute">
                1回のリスク（SLまでの距離）を1Rとして、損益を足し合わせた推移です。
              </p>
              {data.cumulative.length === 0 ? (
                <p className="text-sm text-ink-mute">
                  SLを入れたトレードがまだありません。
                </p>
              ) : (
                <CumulativeChart
                  points={data.cumulative}
                  drawdown={data.drawdown}
                />
              )}
            </section>

            {data.rHistogram && data.rHistogram.some((b) => b.count > 0) && (
              <section className="card min-w-0 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  Rの分布
                  <InfoTip label="Rの分布とは">
                    トレードごとのRを、-2R以下から3R以上まで区切りごとに件数で数えたものです。
                    利を伸ばせているか、損切りを計画通りに実行できているかが見えます。
                  </InfoTip>
                </h2>
                <RHistogramChart bins={data.rHistogram} />
              </section>
            )}
          </div>

          <details className="card">
            <summary className="cursor-pointer text-base font-bold">
              区分別の詳細を見る
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <GroupTable title="セッション別" groups={data.bySession} />
              <GroupTable title="根拠タグ別" groups={data.byRationale} />
              <GroupTable title="ルール遵守別" groups={data.byRule} />
              <GroupTable title="確信度別" groups={data.byConfidence ?? []} />
              <GroupTable
                title="決済方法別"
                groups={data.byExitMethod ?? []}
              />
              <GroupTable title="曜日別" groups={data.byWeekday ?? []} />
              <GroupTable title="時間帯別" groups={data.byHour ?? []} />
              <GroupTable title="保有時間別" groups={data.byHolding ?? []} />
              <GroupTable title="ロット別" groups={data.byLots ?? []} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
