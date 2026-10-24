import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { formatR } from "@/utils/format";
import type { RuleValidation } from "../types";

function Avg({
  label,
  v,
}: {
  label: string;
  v: { n: number; avgR: number | null };
}) {
  return (
    <div>
      <dt className="text-xs text-ink-mute">{label}</dt>
      <dd className="num text-sm">
        {formatR(v.avgR)} <span className="text-xs text-ink-mute">n={v.n}</span>
      </dd>
    </div>
  );
}

/** ルール化した改善案の検証。目標件数（既定10）に達したら前後の成績を比べる */
export function ValidationPanel({ items }: { items: RuleValidation[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card space-y-3" aria-label="検証中の改善ルール">
      <h2 className="text-base font-bold">検証中の改善ルール</h2>
      <ul className="divide-y divide-line">
        {items.map((v) => (
          <li key={v.ruleId} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to={ROUTES.RULE_DETAIL.replace(":id", v.ruleId)}
                className="text-sm font-bold text-accent-link underline"
              >
                {v.title}
              </Link>
              <span className="num text-sm">
                ルール化後 {v.count} / 目標{v.target}件
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Avg label="守った時の平均R" v={v.kept} />
              <Avg label="破った時の平均R" v={v.broken} />
              <Avg label="ルール前の平均R" v={v.before} />
              <Avg label="ルール後の平均R" v={v.after} />
            </dl>
            {v.reached ? (
              <p className="text-xs text-ink-sub">
                目標の件数に達しました。ルール前後の平均Rを見て、続けるかどうか判断できます。
              </p>
            ) : (
              <p className="text-xs text-ink-mute">
                あと{v.target - v.count}
                件ほど記録すると、前後の成績を比べられます。
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
