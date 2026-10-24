import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import type { Improvement } from "../types";

function StatusChip({ i }: { i: Improvement }) {
  if (i.status === "ruled") {
    const v = i.validation;
    return (
      <span className="rounded-chip bg-tag px-2 py-1 text-xs">
        {v && v.count < v.target ? (
          <>
            検証中{" "}
            <span className="num">
              {v.count}/{v.target}
            </span>
          </>
        ) : (
          "ルール化済み"
        )}
      </span>
    );
  }
  return (
    <span className="rounded-chip bg-tag px-2 py-1 text-xs">
      要検証
      {i.sampleN !== null ? <span className="num"> n={i.sampleN}</span> : ""}
    </span>
  );
}

interface Props {
  items: Improvement[];
  busyId: string | null;
  onToRule: (id: string) => void;
}

/** 改善提案。上にあるものほど優先度が高い（回答の並び順のまま） */
export function ImprovementList({ items, busyId, onToRule }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="card space-y-3">
      <h2 className="text-base font-bold">改善提案</h2>
      <ol className="divide-y divide-line">
        {items.map((i, idx) => (
          <li
            key={i.id}
            className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs text-ink-mute">優先 {idx + 1}</p>
              <p className="text-sm">{i.text}</p>
              <StatusChip i={i} />
            </div>
            {i.status === "needs_check" ? (
              <button
                className="btn shrink-0"
                disabled={busyId !== null}
                onClick={() => onToRule(i.id)}
              >
                {busyId === i.id ? "追加中…" : "ルールに追加"}
              </button>
            ) : (
              i.ruleId && (
                <Link
                  className="btn shrink-0"
                  to={ROUTES.RULE_DETAIL.replace(":id", i.ruleId)}
                >
                  ルールを見る
                </Link>
              )
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
