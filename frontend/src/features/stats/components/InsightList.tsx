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
} as const;

function line(i: Insight): string {
  const base = `${AXIS[i.axis]}「${i.label}」`;
  if (i.kind === "needs_check")
    return `${base}は n=${i.n} と少なく、まだ判断できません。あと${i.shortfall}件ほど記録してから判断しましょう。`;
  return `${base}は平均 ${formatR(i.avgR)}（n=${i.n}）。${i.kind === "strength" ? "強み" : "弱み"}の候補です。`;
}

/** 機械的に拾った強み・弱み・要検証。断定せず、件数が少ないものは仮説として示す */
export function InsightList({ insights }: { insights: Insight[] }) {
  const groups: { kind: Insight["kind"]; title: string }[] = [
    { kind: "strength", title: "強み" },
    { kind: "weakness", title: "弱み" },
    { kind: "needs_check", title: "要検証" },
  ];
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold">データから見えること</h2>
      <p className="text-xs text-ink-mute">
        件数が少ないものは傾向ではなく仮説です。
      </p>
      {insights.length === 0 ? (
        <p className="text-sm text-ink-sub">まだ集計できる区分がありません。</p>
      ) : (
        groups.map((g) => {
          const items = insights.filter((i) => i.kind === g.kind);
          if (items.length === 0) return null;
          return (
            <div key={g.kind}>
              <h3 className="text-sm font-bold">{g.title}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-sub">
                {items.map((i) => (
                  <li key={`${i.axis}:${i.label}`}>{line(i)}</li>
                ))}
              </ul>
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
