import { formatR } from "@/utils/format";
import type { DayStat } from "../weeklyTypes";
import { dayLabel } from "../utils/week";

/** 日別のR。色だけでなく符号つきの数値も出す。Rが計算できない日は「—」 */
export function DayBars({ days }: { days: DayStat[] }) {
  const max = Math.max(1, ...days.map((d) => Math.abs(d.r)));
  return (
    <ul className="space-y-1" aria-label="日別のR">
      {days.map((d) => {
        const width = d.rCount === 0 ? 0 : (Math.abs(d.r) / max) * 100;
        return (
          <li key={d.date} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-ink-sub">
              {dayLabel(d.date)}
            </span>
            <span className="h-3 flex-1 rounded bg-surface">
              <span
                className={`block h-3 rounded ${d.r < 0 ? "bg-loss" : "bg-profit"}`}
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="num w-20 shrink-0 text-right">
              {d.rCount === 0 ? "—" : formatR(d.r)}
            </span>
            <span className="num w-10 shrink-0 text-right text-xs text-ink-mute">
              {d.n}件
            </span>
          </li>
        );
      })}
    </ul>
  );
}
