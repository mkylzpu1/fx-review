import type { CumulativePoint, Drawdown } from "../types";

interface Props {
  points: CumulativePoint[];
  drawdown: Drawdown | null;
}

const W = 640;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 24 };

/** 累積R（トレード番号・古い順）の折れ線。最大ドローダウン区間は赤い帯で示す */
export function CumulativeChart({ points, drawdown }: Props) {
  if (points.length === 0) return null;
  const series = [{ index: 0, cumulative: 0 }, ...points];
  const maxIdx = series[series.length - 1].index || 1;
  const ys = series.map((p) => p.cumulative);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const span = hi - lo || 1;
  const x = (i: number) => PAD.l + (i / maxIdx) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)},${y(p.cumulative)}`)
    .join(" ");
  const last = series[series.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`累積R。最終 ${last.cumulative.toFixed(2)}R、${points.length}件`}
        className="w-full"
      >
        {drawdown && (
          <rect
            data-testid="drawdown-band"
            x={x(drawdown.peakIndex)}
            width={Math.max(2, x(drawdown.troughIndex) - x(drawdown.peakIndex))}
            y={PAD.t}
            height={H - PAD.t - PAD.b}
            className="fill-loss/20"
          />
        )}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={y(0)}
          y2={y(0)}
          className="stroke-line"
          strokeDasharray="4 4"
        />
        <path
          d={path}
          fill="none"
          className="stroke-accent-link"
          strokeWidth={2}
        />
        <text
          x={PAD.l - 6}
          y={y(hi) + 4}
          textAnchor="end"
          className="num fill-ink-mute text-[10px]"
        >
          {hi.toFixed(1)}
        </text>
        <text
          x={PAD.l - 6}
          y={y(lo) + 4}
          textAnchor="end"
          className="num fill-ink-mute text-[10px]"
        >
          {lo.toFixed(1)}
        </text>
        <text
          x={W - PAD.r}
          y={H - 6}
          textAnchor="end"
          className="num fill-ink-mute text-[10px]"
        >
          {maxIdx}件目
        </text>
      </svg>
      {drawdown && (
        <figcaption className="mt-1 text-xs text-ink-mute">
          赤い帯: 最大ドローダウン（{drawdown.peakIndex}件目 →{" "}
          {drawdown.troughIndex}件目、
          <span className="num">−{drawdown.depth.toFixed(2)}R</span>）
        </figcaption>
      )}
    </figure>
  );
}
