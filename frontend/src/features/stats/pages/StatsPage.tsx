import { useState } from "react";
import { Link } from "react-router-dom";
import { SegmentedControl as Seg } from "@/components/common/SegmentedControl";
import { EmptyState } from "@/components/common/EmptyState";
import { InfoTip } from "@/components/common/InfoTip";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { CumulativeChart } from "../components/CumulativeChart";
import { DailyGrowthChart } from "../components/DailyGrowthChart";
import { GroupPnlChart } from "../components/GroupPnlChart";
import { GroupTable } from "../components/GroupTable";
import { InsightList } from "../components/InsightList";
import { RHistogramChart } from "../components/RHistogramChart";
import { TimeBandPnlChart } from "../components/TimeBandPnlChart";
import { PeriodCompare } from "../components/PeriodCompare";
import { usePreviousStats, useStats } from "../hooks/useStats";
import type { PeriodKey } from "../types";
import { GRANULARITIES, type Granularity } from "../utils/daily";
import { PERIODS } from "../utils/period";

/** 期間ボタンの並び（/tradesの期間選択と同じ）。「期間を指定」だけボタンではなく、隣の日付入力で代える */
const PERIOD_OPTIONS = PERIODS.filter((p) => p.value !== "custom");

/** /tradesの期間を日付で指定する入力と同じ見た目 */
const dateCls =
  "h-[30px] rounded-[7px] border-0 bg-transparent px-1 text-[13px] text-ink [color-scheme:dark]";

/** 統計。R系はRが計算できるトレードだけ、勝率・pips・円は全件（SLは任意項目のため） */
export function StatsPage() {
  const [period, setPeriod] = useState<PeriodKey>("90d");
  // 損益・pipsの棒グラフの間隔（日/週/月/年）。両方のチャートで共通
  const [granularity, setGranularity] = useState<Granularity>("day");
  // 期間を日付で指定（/tradesと同じ）。どちらかが入っていれば上の期間ボタンより優先する
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const customActive = dateFrom !== "" || dateTo !== "";
  const effectivePeriod: PeriodKey = customActive ? "custom" : period;

  const { data, isLoading, isError, refetch } = useStats(
    effectivePeriod,
    undefined,
    { from: dateFrom, to: dateTo },
  );
  const prevStats = usePreviousStats(effectivePeriod);

  // 期間ボタンを押したら、日付指定は解除してボタンの期間に戻す
  const pickPeriod = (v: PeriodKey) => {
    setDateFrom("");
    setDateTo("");
    setPeriod(v);
  };
  // 開始日が終了日より後にならないよう、片方を変えたらもう片方を合わせる
  const changeDateFrom = (v: string) => {
    setDateFrom(v);
    if (v && dateTo && v > dateTo) setDateTo(v);
  };
  const changeDateTo = (v: string) => {
    setDateTo(v);
    if (v && dateFrom && v < dateFrom) setDateFrom(v);
  };

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;
  const s = data.summary;
  const periodLabel = customActive
    ? "期間を指定"
    : (PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold">統計</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            label="期間"
            value={customActive ? ("custom" as PeriodKey) : period}
            options={PERIOD_OPTIONS}
            onChange={pickPeriod}
          />
          <div
            role="group"
            aria-label="期間を日付で指定"
            className={`inline-flex h-[38px] items-center gap-1.5 rounded-chip border px-2.5 text-[13px] ${
              customActive ? "border-accent bg-accent/10" : "border-field"
            }`}
          >
            <span className="text-xs text-ink-mute">日付</span>
            <input
              type="date"
              aria-label="開始日"
              className={dateCls}
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => changeDateFrom(e.target.value)}
            />
            <span aria-hidden="true" className="text-ink-mute">
              〜
            </span>
            <input
              type="date"
              aria-label="終了日"
              className={dateCls}
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => changeDateTo(e.target.value)}
            />
            {customActive && (
              <button
                type="button"
                aria-label="日付指定をクリア"
                className="ml-0.5 px-1 text-ink-mute hover:text-ink"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {data.closedCount > 0 && (
        <PeriodCompare
          now={s}
          prev={
            prevStats.data && prevStats.data.closedCount > 0
              ? prevStats.data.summary
              : null
          }
          periodLabel={periodLabel}
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
          <InsightList insights={data.insights} summary={s} />

          <div className="grid gap-4 sm:grid-cols-2">
            {(data.daily ?? []).length > 0 && (
              <>
                <div
                  role="group"
                  aria-label="棒グラフの間隔"
                  className="flex items-center gap-1 sm:col-span-2"
                >
                  {GRANULARITIES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={granularity === g.value}
                      onClick={() => setGranularity(g.value)}
                      className={`btn !px-3 !py-1 text-xs ${
                        granularity === g.value
                          ? "border-accent bg-accent/10 text-accent-link"
                          : ""
                      }`}
                    >
                      {g.label}単位
                    </button>
                  ))}
                </div>

                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    損益
                    <InfoTip label="日々の成長（損益）とは">
                      取引のあった日ごとの成績です。上の折れ線は「その日までの合計」、
                      下の棒は「その日だけの成績」です。日/週/月/年の単位で切り替えられます。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart
                    daily={data.daily ?? []}
                    metric="pnl"
                    granularity={granularity}
                  />
                </section>

                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    pips
                    <InfoTip label="日々の成長（pips）とは">
                      取引のあった日ごとの成績です。上の折れ線は「その日までの合計」、
                      下の棒は「その日だけの成績」です。日/週/月/年の単位で切り替えられます。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart
                    daily={data.daily ?? []}
                    metric="pips"
                    granularity={granularity}
                  />
                </section>

                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    勝率
                    <InfoTip label="日々の成長（勝率）とは">
                      取引のあった日ごとの勝率です。上の折れ線は「そこまでの通算勝率」、
                      下の棒は「その日だけの勝率」（緑=50%以上、赤=50%未満）です。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart
                    daily={data.daily ?? []}
                    metric="winRate"
                    granularity={granularity}
                  />
                </section>

                <section className="card min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    トレード数
                    <InfoTip label="日々の成長（トレード数）とは">
                      取引のあった日ごとの件数です。上の折れ線は「そこまでの通算件数」、
                      下の棒は「その日だけの件数」です。取引量のペースが見えます。
                    </InfoTip>
                  </h2>
                  <DailyGrowthChart
                    daily={data.daily ?? []}
                    metric="count"
                    granularity={granularity}
                  />
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

            {data.rationalePnl && data.rationalePnl.length > 0 && (
              <section className="card min-w-0 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  根拠タグ別の損益と勝率
                  <InfoTip label="根拠タグ別の損益と勝率とは">
                    エントリーの根拠タグごとに、合計損益（棒）と勝率（線・右軸）をまとめたものです。
                    1トレードに複数タグがあれば、それぞれのタグの集計に重複して数えます。
                  </InfoTip>
                </h2>
                <GroupPnlChart groups={data.rationalePnl} />
              </section>
            )}

            {data.emotionPnl && data.emotionPnl.length > 0 && (
              <section className="card min-w-0 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  感情タグ別の損益と勝率
                  <InfoTip label="感情タグ別の損益と勝率とは">
                    エントリー時の感情タグごとに、合計損益（棒）と勝率（線・右軸）をまとめたものです。
                    どんな心理状態のときに成績が崩れやすいかが見えます。
                  </InfoTip>
                </h2>
                <GroupPnlChart groups={data.emotionPnl} />
              </section>
            )}

            {((data.sessionPnl && data.sessionPnl.length > 0) ||
              (data.hourPnl && data.hourPnl.length > 0)) && (
              <section className="card min-w-0 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  時間帯別の損益と勝率
                  <InfoTip label="時間帯別の損益と勝率とは">
                    トレードした時間帯ごとの合計損益（棒）と勝率（線・右軸）です。
                    東京・ロンドン・NYのセッション単位と、1時間ごとの単位を切り替えて見られます。
                  </InfoTip>
                </h2>
                <TimeBandPnlChart
                  bySession={data.sessionPnl ?? []}
                  byHour={data.hourPnl ?? []}
                />
              </section>
            )}

            {data.confidencePnl && data.confidencePnl.length > 0 && (
              <section className="card min-w-0 space-y-2">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  確信度別の損益と勝率
                  <InfoTip label="確信度別の損益と勝率とは">
                    エントリー時に入力した確信度（1〜5）ごとの合計損益（棒）と勝率（線・右軸）です。
                  </InfoTip>
                </h2>
                <GroupPnlChart groups={data.confidencePnl} />
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
