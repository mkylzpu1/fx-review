import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { formatR } from "@/utils/format";
import type { Insight, Summary } from "../types";

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

const TOP_N = 3;

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

/** 機械的に拾った強み・弱み。上位3件だけを表示し、残りはリンクで開く */
function Column({ kind, items }: { kind: Insight["kind"]; items: Insight[] }) {
  const [expanded, setExpanded] = useState(false);
  const style = KIND_STYLE[kind];
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, TOP_N);
  const rest = items.length - shown.length;
  return (
    <div>
      <h3 className="text-sm font-bold">
        {style.title}
        {items.length > TOP_N && !expanded && (
          <span className="ml-1 text-xs font-normal text-ink-mute">
            （上位{TOP_N}件）
          </span>
        )}
      </h3>
      <ul className="mt-1 space-y-0.5">
        {shown.map((i) => (
          <Row key={`${i.axis}:${i.label}`} i={i} />
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          className="mt-1 text-xs text-accent-link hover:underline"
          onClick={() => setExpanded(true)}
        >
          残り{rest}件をすべて見る →
        </button>
      )}
    </div>
  );
}

/** payoffRatio・連敗など、summarize由来の補助指標を小さなタイルで並べる */
function AuxTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "loss";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3">
      <div>
        <p className="text-xs text-ink-mute">{label}</p>
        <p
          className={`num text-xl font-bold ${tone === "loss" ? "text-loss" : ""}`}
        >
          {value}
        </p>
      </div>
      <p className="max-w-[9rem] text-right text-xs text-ink-mute">{note}</p>
    </div>
  );
}

export function InsightList({
  insights,
  summary,
}: {
  insights: Insight[];
  summary: Summary;
}) {
  const strength = insights.filter((i) => i.kind === "strength");
  const weakness = insights.filter((i) => i.kind === "weakness");
  const needsCheck = insights.filter((i) => i.kind === "needs_check");

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">データから見えること</h2>
        <Link
          className="rounded-chip border border-accent px-3 py-1.5 text-sm text-accent-link"
          to={ROUTES.EXPORT}
        >
          AIに分析してもらう →
        </Link>
      </div>

      {summary.rMissing > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-card border border-caution bg-caution/10 px-3.5 py-2.5"
        >
          <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-caution text-xs font-extrabold text-bg">
            !
          </span>
          <p className="text-sm leading-relaxed">
            <span className="font-bold text-caution">
              SLが入っていない{summary.rMissing}件（全体の
              {summary.n === 0
                ? 0
                : Math.round((summary.rMissing / summary.n) * 100)}
              %）
            </span>{" "}
            <span className="text-ink-sub">
              は、R系の集計に入っていません（勝率・pips・損益には入っています）。損切りのリスク管理ができていない可能性もあるので確認してください。
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <AuxTile
          label="ペイオフレシオ（勝ち平均R ÷ 負け平均R）"
          value={
            summary.payoffRatio === null ? "—" : summary.payoffRatio.toFixed(2)
          }
          note="損大利小の傾向がないか確認"
        />
        <AuxTile
          label="現在の連敗"
          value={
            summary.currentLossStreak === 0
              ? "連敗なし"
              : `${summary.currentLossStreak}連敗中`
          }
          tone={summary.currentLossStreak > 0 ? "loss" : undefined}
          note={`最大${summary.maxLossStreak}連敗の記録あり`}
        />
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-ink-sub">まだ集計できる区分がありません。</p>
      ) : (
        <>
          {(strength.length > 0 || weakness.length > 0) && (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Column kind="strength" items={strength} />
              <Column kind="weakness" items={weakness} />
            </div>
          )}
          {needsCheck.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-bold">
                要検証（{needsCheck.length}件・件数不足で判断保留）
              </summary>
              <ul className="mt-1 space-y-0.5">
                {needsCheck.map((i) => (
                  <Row key={`${i.axis}:${i.label}`} i={i} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
