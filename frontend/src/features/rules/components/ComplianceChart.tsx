import type { ComplianceWeek } from "../types";

const label = (weekStart: string) => {
  const [, m, d] = weekStart.split("-");
  return `${Number(m)}/${Number(d)}週`;
};

/** 遵守率の週次推移。判定のない週は「—」。色だけでなく % と件数も出す */
export function ComplianceChart({ weeks }: { weeks: ComplianceWeek[] }) {
  return (
    <ul className="space-y-1" aria-label="遵守率の週次推移">
      {weeks.map((w) => (
        <li key={w.weekStart} className="flex items-center gap-3 text-sm">
          <span className="num w-16 shrink-0 text-ink-sub">
            {label(w.weekStart)}
          </span>
          <span className="h-3 flex-1 rounded bg-surface">
            <span
              className="block h-3 rounded bg-accent"
              style={{ width: `${w.rate ?? 0}%` }}
            />
          </span>
          <span className="num w-14 shrink-0 text-right">
            {w.rate === null ? "—" : `${w.rate.toFixed(0)}%`}
          </span>
          <span className="num w-24 shrink-0 text-right text-xs text-ink-mute">
            守{w.kept} / 破{w.broke}
          </span>
        </li>
      ))}
    </ul>
  );
}
