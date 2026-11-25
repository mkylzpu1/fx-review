import { Fragment, useState } from "react";
import { formatYenSigned } from "@/utils/format";
import type { HeatmapCell } from "../types";

interface Props {
  cells: HeatmapCell[];
}

/** 勝率に応じて緑(勝率が高い)〜赤(勝率が低い)の背景色を、0.5(50%)を中間として出す。nullはトレードなし(無色) */
function cellStyle(winRate: number | null): React.CSSProperties {
  if (winRate === null) return {};
  const t = Math.max(0, Math.min(1, winRate));
  // 0 -> 赤寄り、0.5 -> ニュートラル、1 -> 緑寄り。中間に近いほど薄く
  const dist = Math.abs(t - 0.5) * 2; // 0〜1
  const alpha = 0.12 + dist * 0.55;
  const color = t >= 0.5 ? "110,231,200" : "255,122,138"; // profit / loss のRGB
  return { background: `rgba(${color},${alpha})` };
}

/**
 * 曜日×時間帯(4時間刻み)の勝率ヒートマップ。マスには勝率とn件数を併記し、
 * 件数が少ないマスの色だけで判断しないようにする。件数0のマスは「—」。
 */
export function WeekdayHourHeatmap({ cells }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  if (cells.length === 0) return null;

  const bandOrder = [...new Set(cells.map((c) => c.band))];
  const bandLabels = new Map(cells.map((c) => [c.band, c.bandLabel]));
  const weekdayOrder = [...new Set(cells.map((c) => c.weekday))];
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.band}`, c]));
  const hc = hover ? byKey.get(hover) : null;

  return (
    <div className="space-y-2">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `3rem repeat(${bandOrder.length}, 1fr)`,
        }}
      >
        <div />
        {bandOrder.map((b) => (
          <div
            key={b}
            className="text-center text-[10px] text-ink-mute"
          >
            {bandLabels.get(b)}
          </div>
        ))}
        {weekdayOrder.map((wd) => {
          const label = cells.find((c) => c.weekday === wd)?.weekdayLabel ?? wd;
          return (
            <Fragment key={wd}>
              <div className="flex items-center text-xs text-ink-sub">
                {label}
              </div>
              {bandOrder.map((b) => {
                const cell = byKey.get(`${wd}:${b}`);
                const key = `${wd}:${b}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() => setHover(key)}
                    onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                    onFocus={() => setHover(key)}
                    onBlur={() => setHover((h) => (h === key ? null : h))}
                    style={cellStyle(cell?.winRate ?? null)}
                    className="flex aspect-square min-w-0 items-center justify-center rounded bg-tag text-[10px] font-medium text-ink"
                  >
                    {cell && cell.n > 0
                      ? `${Math.round((cell.winRate ?? 0) * 100)}%`
                      : "—"}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink-mute">
        <span>勝率低い</span>
        <div className="flex">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div key={v} style={cellStyle(v)} className="h-2.5 w-5" />
          ))}
        </div>
        <span>勝率高い</span>
      </div>

      {hc && (
        <p className="text-xs text-ink-mute">
          {hc.weekdayLabel}・{hc.bandLabel}：
          {hc.n === 0 ? (
            "トレードなし"
          ) : (
            <>
              勝率{Math.round((hc.winRate ?? 0) * 100)}%（n={hc.n}）、損益
              {formatYenSigned(hc.pnlJpy)}
            </>
          )}
        </p>
      )}

      <p className="text-xs text-ink-mute">
        マスの色は勝率（緑=高い・赤=低い）、数字も勝率です。件数が少ないマスは一部のトレードで
        極端な値になりやすいので、色が濃くてもnが小さいときは参考程度にしてください。
      </p>
    </div>
  );
}
