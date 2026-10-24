import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import {
  formatJst,
  formatPips,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import { DayBars } from "../components/DayBars";
import { WeeklyReviewForm } from "../components/WeeklyReviewForm";
import { useWeekly } from "../hooks/useWeekly";
import { shiftWeek, weekLabel } from "../utils/week";

const COMMENT_MARK = {
  strength: "強み",
  weakness: "弱み",
  note: "注記",
} as const;

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

/** 週次レビュー（月〜日・JST）。統計画面から入る */
export function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useWeekly(weekStart);

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const p = data.planned;
  const judged = data.rule.kept + data.rule.broke;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">週次レビュー</h1>
        <Link className="btn" to={ROUTES.STATS}>
          統計へ戻る
        </Link>
      </div>

      <div
        className="flex items-center gap-2"
        role="group"
        aria-label="週の切り替え"
      >
        <button
          className="btn"
          onClick={() => setWeekStart(shiftWeek(data.weekStart, -1))}
        >
          前の週
        </button>
        <p className="num flex-1 text-center text-sm">
          {weekLabel(data.weekStart, data.weekEnd)}
        </p>
        <button
          className="btn"
          onClick={() => setWeekStart(shiftWeek(data.weekStart, 1))}
        >
          次の週
        </button>
      </div>

      {data.n === 0 ? (
        <EmptyState
          title="この週の決済済みトレードはありません"
          description="別の週に切り替えるか、トレードを記録・取り込みしてください。"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="トレード数" value={`${data.n}件`} />
            <Metric
              label="勝率"
              value={
                data.winRate === null ? "—" : `${data.winRate.toFixed(1)}%`
              }
              note={`n=${data.n}`}
            />
            <Metric
              label="合計R"
              value={formatR(data.rCount === 0 ? null : data.totalR)}
              note={`R計算 n=${data.rCount}`}
            />
            <Metric label="合計pips" value={formatPips(data.totalPips)} />
          </div>
          <p className="text-xs text-ink-mute">
            ルール遵守: 守った{data.rule.kept}件 / 破った{data.rule.broke}件 /
            判定なし{data.rule.none}件
            {judged === 0
              ? ""
              : `（判定のある${judged}件中 ${Math.round((data.rule.kept / judged) * 100)}%）`}
            {data.rMissing > 0 && ` ／ SLなしのため R未計算 ${data.rMissing}件`}
          </p>

          <section className="card space-y-2">
            <h2 className="text-base font-bold">日別のR</h2>
            <DayBars days={data.days} />
          </section>

          <section className="card space-y-2">
            <h2 className="text-base font-bold">計画どおりに持っていたら</h2>
            {p.eligibleCount === 0 ? (
              <p className="text-sm text-ink-sub">
                TPが入っている手動決済がないため、比べられません。
                {p.excludedCount > 0 && `（対象外 ${p.excludedCount}件）`}
              </p>
            ) : (
              <>
                <p className="text-sm">
                  TPまで保持しなかった手動決済{p.eligibleCount}
                  件を計画どおり決済していたら、この週の合計Rは
                  <span className="num font-bold">
                    {" "}
                    {formatR(p.plannedTotalR)}{" "}
                  </span>
                  でした（実際との差{" "}
                  <span className="num">{formatR(p.diffR)}</span>）。
                </p>
                {p.emotions.length > 0 && (
                  <p className="text-sm text-ink-sub">
                    そのときの感情:{" "}
                    {p.emotions.map((e) => `${e.name}（${e.n}件）`).join("、")}
                  </p>
                )}
                {p.excludedCount > 0 && (
                  <p className="text-xs text-ink-mute">
                    TPまたはSLが無い手動決済{p.excludedCount}
                    件は、この比較に含めていません。
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card space-y-2">
            <h2 className="text-base font-bold">今週のトレード</h2>
            <ul className="divide-y divide-line">
              {data.trades.map((t) => (
                <li key={t.id}>
                  <Link
                    to={ROUTES.TRADE_DETAIL.replace(":id", t.id)}
                    className="flex min-h-touch items-center gap-3 text-sm hover:bg-surface"
                  >
                    <span className="num w-32 shrink-0 text-ink-sub">
                      {formatJst(t.entryAt)}
                    </span>
                    <span className="w-10 shrink-0">
                      {t.side === "buy" ? "買い" : "売り"}
                    </span>
                    <span className="num flex-1">{formatPips(t.pips)}</span>
                    <span className="num w-20 text-right">
                      {formatR(t.rMultiple)}
                    </span>
                    <span className="num hidden w-24 text-right sm:block">
                      {formatYenSigned(t.pnlJpy)}
                    </span>
                    {t.deviation && (
                      <span className="text-xs text-caution">ルール逸脱</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {data.comments.length > 0 && (
            <section className="card space-y-2">
              <h2 className="text-base font-bold">この週のコメント</h2>
              <ul className="space-y-1 text-sm">
                {data.comments.map((c) => (
                  <li key={c.text}>
                    <span className="mr-2 text-xs text-ink-mute">
                      [{COMMENT_MARK[c.kind]}]
                    </span>
                    {c.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <WeeklyReviewForm
        key={`${data.weekStart}:${data.review?.memo ?? ""}`}
        data={data}
      />
    </div>
  );
}
