import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { SIDE_LABEL, formatJst, formatPips, formatR } from "@/utils/format";
import { useTrades } from "../hooks/useTradesApi";
import { summarize } from "../utils/summary";

type Tab = "all" | "win" | "loss";
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "win", label: "勝ち" },
  { value: "loss", label: "負け" },
];

/** 詳細画面の左側: 直近のトレードに素早く移る（直近6件の勝率・PF・平均Rつき） */
export function RecentTrades({ currentId }: { currentId: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const { data } = useTrades({
    result: tab === "all" ? undefined : tab,
    limit: 6,
  });
  const items = data?.items ?? [];
  const s = summarize(items);

  return (
    <aside className="card space-y-3" aria-label="直近のトレード">
      <h2 className="text-sm font-bold">直近のトレード</h2>
      <div role="group" aria-label="結果で絞り込み" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            aria-pressed={tab === t.value}
            className={`btn min-h-0 px-3 py-1 text-xs ${tab === t.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {s.closed > 0 && (
        <p className="text-xs text-ink-sub">
          直近{items.length}件 勝率 <span className="num">{s.winRate}%</span>
          {s.profitFactor !== null && (
            <>
              {" ・ "}PF <span className="num">{s.profitFactor}</span>
            </>
          )}
          {s.avgR !== null && (
            <>
              {" ・ "}平均 <span className="num">{formatR(s.avgR)}</span>
            </>
          )}
        </p>
      )}
      <ul className="divide-y divide-line">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              to={ROUTES.TRADE_DETAIL.replace(":id", t.id)}
              aria-current={t.id === currentId ? "page" : undefined}
              className={`block rounded-btn px-2 py-2 text-sm hover:bg-surface ${t.id === currentId ? "bg-surface font-medium" : ""}`}
            >
              <span className="num text-xs text-ink-sub">
                {formatJst(t.entryAt)}
              </span>
              <span className="mt-0.5 flex justify-between gap-2">
                <span>
                  {t.pair} {SIDE_LABEL[t.side]}
                </span>
                <span className="num">{formatPips(t.pips)}</span>
              </span>
            </Link>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-2 text-sm text-ink-mute">
            該当するトレードはありません
          </li>
        )}
      </ul>
    </aside>
  );
}
