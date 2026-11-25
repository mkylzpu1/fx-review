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
  const [hover, setHover] = useState<{ key: string; col: number } | null>(
    null,
  );
  if (cells.length === 0) return null;

  const bandOrder = [...new Set(cells.map((c) => c.band))];
  const bandLabels = new Map(cells.map((c) => [c.band, c.bandLabel]));
  const weekdayOrder = [...new Set(cells.map((c) => c.weekday))];
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.band}`, c]));
  const hc = hover ? byKey.get(hover.key) : null;
  const nCols = bandOrder.length;

  return (
    <div className="relative space-y-2">
      <div
        className="mx-auto grid max-w-[320px] gap-[2px]"
        style={{
          gridTemplateColumns: `2rem repeat(${nCols}, 1fr)`,
        }}
      >
        <div />
        {bandOrder.map((b) => (
          <div
            key={b}
            className="truncate text-center text-[9px] text-ink-mute"
          >
            {bandLabels.get(b)}
          </div>
        ))}
        {weekdayOrder.map((wd) => {
          const label = cells.find((c) => c.weekday === wd)?.weekdayLabel ?? wd;
          return (
            <Fragment key={wd}>
              <div className="flex items-center text-[11px] text-ink-sub">
                {label}
              </div>
              {bandOrder.map((b, col) => {
                const cell = byKey.get(`${wd}:${b}`);
                const key = `${wd}:${b}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() => setHover({ key, col })}
                    onMouseLeave={() =>
                      setHover((h) => (h?.key === key ? null : h))
                    }
                    onFocus={() => setHover({ key, col })}
                    onBlur={() =>
                      setHover((h) => (h?.key === key ? null : h))
                    }
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

      {hc && hover && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 w-44 rounded-btn border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={
            hover.col / nCols > 0.6
              ? { right: `${(1 - (hover.col + 1) / nCols) * 100 + 2}%` }
              : { left: `${(hover.col / nCols) * 100 + 2}%` }
          }
        >
          <p className="font-bold text-ink">
            {hc.weekdayLabel}・{hc.bandLabel}
          </p>
          {hc.n === 0 ? (
            <p className="mt-1 text-ink-sub">トレードなし</p>
          ) : (
            <>
              <p className="mt-1 flex justify-between gap-2">
                <span className="text-ink-sub">勝率</span>
                <span className="num font-bold">
                  {Math.round((hc.winRate ?? 0) * 100)}%
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-ink-sub">損益</span>
                <span className="num">{formatYenSigned(hc.pnlJpy)}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-ink-sub">件数</span>
                <span className="num">n={hc.n}</span>
              </p>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-ink-mute">
        マスの色は勝率（緑=高い・赤=低い）、数字も勝率です。件数が少ないマスは一部のトレードで
        極端な値になりやすいので、色が濃くてもnが小さいときは参考程度にしてください。
      </p>
    </div>
  );
}
