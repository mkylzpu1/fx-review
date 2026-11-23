import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { formatR } from "@/utils/format";
import type { Insight } from "../types";

const AXIS = {
  session: "セッション",
  rationale: "根拠",
  rule: "ルール",
  weekday: "曜日",
  hour: "時間帯",
  holding: "保有時間",
  lots: "ロット",
  confidence: "確信度",
  exitMethod: "決済方法",
} as const;

const KIND_STYLE: Record<
  Insight["kind"],
  { title: string; row: string; value: string }
> = {
  strength: {
    title: "強み",
    row: "border-profit/40",
    value: "text-profit",
  },
  weakness: {
    title: "弱み",
    row: "border-loss/40",
    value: "text-loss",
  },
  needs_check: {
    title: "要検証",
    row: "border-line",
    value: "text-ink-mute",
  },
};

/** 一覧の1行。文章にせず「区分名＋値」の形に揃えて、繰り返しの定型文を減らす */
function Row({ i }: { i: Insight }) {
  const style = KIND_STYLE[i.kind];
  return (
    <li
      className={`flex items-center justify-between gap-2 border-l-2 py-1 pl-2 text-sm ${style.row}`}
    >
      <span className="text-ink-sub">
        {AXIS[i.axis]}「{i.label}」
      </span>
      {i.kind === "needs_check" ? (
        <span className="num shrink-0 text-xs text-ink-mute">
          n={i.n}（あと{i.shortfall}件）
        </span>
      ) : (
        <span className="num shrink-0">
          <span className={`font-bold ${style.value}`}>{formatR(i.avgR)}</span>
          <span className="ml-1 text-xs text-ink-mute">n={i.n}</span>
        </span>
      )}
    </li>
  );
}

/** 機械的に拾った強み・弱み・要検証。断定せず、件数が少ないものは仮説として示す */
export function InsightList({ insights }: { insights: Insight[] }) {
  const groups: { kind: Insight["kind"] }[] = [
    { kind: "strength" },
    { kind: "weakness" },
    { kind: "needs_check" },
  ];
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold">データから見えること</h2>
      {insights.length === 0 ? (
        <p className="text-sm text-ink-sub">まだ集計できる区分がありません。</p>
      ) : (
        groups.map((g) => {
          const items = insights.filter((i) => i.kind === g.kind);
          if (items.length === 0) return null;
          const style = KIND_STYLE[g.kind];
          const body = (
            <ul className="mt-1 space-y-0.5">
              {items.map((i) => (
                <Row key={`${i.axis}:${i.label}`} i={i} />
              ))}
            </ul>
          );
          return g.kind === "needs_check" ? (
            <details key={g.kind}>
              <summary className="cursor-pointer text-sm font-bold">
                {style.title}（{items.length}件・件数不足で判断保留）
              </summary>
              {body}
            </details>
          ) : (
            <div key={g.kind}>
              <h3 className="text-sm font-bold">{style.title}</h3>
              {body}
            </div>
          );
        })
      )}
      <Link className="btn-primary" to={ROUTES.EXPORT}>
        AIに分析してもらう
      </Link>
    </section>
  );
}
