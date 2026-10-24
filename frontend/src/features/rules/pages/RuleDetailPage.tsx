import { Link, useParams } from "react-router-dom";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ROUTES } from "@/constants/routes";
import { ValidationPanel } from "@/features/notes/components/ValidationPanel";
import {
  formatJst,
  formatPips,
  formatR,
  formatYenSigned,
  SIDE_LABEL,
} from "@/utils/format";
import { ComplianceChart } from "../components/ComplianceChart";
import { useRuleDetail } from "../hooks/useRulesApi";
import { AUTO_KEY_LABEL } from "../types";

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

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/** ルール詳細。判定のあるトレード（守った・破った）だけで集計し、n を併記する */
export function RuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useRuleDetail(id);

  if (isLoading) return <LoadingSpinner fullScreen={false} />;
  if (isError || !data) return <ErrorAlert onRetry={() => void refetch()} />;

  const { rule } = data;
  const judged = data.kept + data.broke;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{rule.title}</h1>
          <p className="text-xs text-ink-mute">
            {rule.autoKey ? AUTO_KEY_LABEL[rule.autoKey] : "手動でチェック"}
            {!rule.isActive && " ・ 無効"}
            {rule.validationStartedAt && " ・ 検証中"}
          </p>
        </div>
        <Link className="btn" to={ROUTES.RULES}>
          ルール一覧へ
        </Link>
      </div>
      {rule.description && (
        <p className="text-sm text-ink-sub">{rule.description}</p>
      )}

      {judged === 0 ? (
        <section className="card space-y-1">
          <p className="text-base font-bold">
            まだ判定のあるトレードがありません
          </p>
          <p className="text-sm text-ink-sub">
            トレードの記録で「発注前チェック」を入れるか、自動判定に必要なSL・TPを入れると、ここに遵守率が出ます。
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label={`直近${data.recent.weeks}週の遵守率`}
              value={pct(data.recent.rate)}
              note={`守${data.recent.kept} / 破${data.recent.broke}`}
            />
            <Metric
              label="全期間の遵守率"
              value={pct((data.kept / judged) * 100)}
              note={`n=${judged}`}
            />
            <Metric
              label="守った時の平均R"
              value={formatR(data.avgKept.avgR)}
              note={`R計算 n=${data.avgKept.n}`}
            />
            <Metric
              label="破った時の平均R"
              value={formatR(data.avgBroken.avgR)}
              note={`R計算 n=${data.avgBroken.n}`}
            />
          </div>
          <p className="text-xs text-ink-mute">
            判定なし・SLなどが未入力のトレードは、遵守率に入っていません。平均RはRが計算できるトレードだけです。
          </p>

          <section className="card space-y-2">
            <h2 className="text-base font-bold">遵守率の週次推移</h2>
            <ComplianceChart weeks={data.weekly} />
          </section>

          <section className="card space-y-2">
            <h2 className="text-base font-bold">
              破ったトレード
              <span className="num ml-2 text-xs font-normal text-ink-mute">
                {data.brokenTotal}件
              </span>
            </h2>
            {data.brokenTrades.length === 0 ? (
              <p className="text-sm text-ink-sub">
                破ったトレードはありません。
              </p>
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {data.brokenTrades.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={ROUTES.TRADE_DETAIL.replace(":id", t.id)}
                        className="flex min-h-touch items-center gap-3 text-sm hover:bg-surface"
                      >
                        <span className="num w-32 shrink-0 text-ink-sub">
                          {formatJst(t.entryAt)}
                        </span>
                        <span className="w-10 shrink-0">
                          {SIDE_LABEL[t.side]}
                        </span>
                        <span className="num flex-1">{formatPips(t.pips)}</span>
                        <span className="num w-20 text-right">
                          {formatR(t.rMultiple)}
                        </span>
                        <span className="num hidden w-24 text-right sm:block">
                          {formatYenSigned(t.pnlJpy)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {data.brokenTotal > data.brokenTrades.length && (
                  <p className="text-xs text-ink-mute">
                    新しい順に{data.brokenTrades.length}件を表示しています。
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}

      {data.validation && <ValidationPanel items={[data.validation]} />}
    </div>
  );
}
