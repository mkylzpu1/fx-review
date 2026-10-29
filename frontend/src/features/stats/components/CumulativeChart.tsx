import { useRef, useState } from "react";
import { formatJst, formatR } from "@/utils/format";
import type { CumulativePoint, Drawdown } from "../types";

interface Props {
  points: CumulativePoint[];
  drawdown: Drawdown | null;
}

const W = 640;
const H = 190;
const PAD = { l: 44, r: 12, t: 12, b: 24 };

/** 累積R（トレード番号・古い順）の折れ線。最大ドローダウン区間は赤い帯で示す */
export function CumulativeChart({ points, drawdown }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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

  /** 画面上のX座標から、いちばん近い件を選ぶ（マウス・タッチ共通） */
  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * maxIdx);
    setHover(Math.min(maxIdx, Math.max(0, i)));
  };
  const hp = hover === null ? null : series[hover];

  return (
    <figure className="relative">
      <svg
        ref={svgRef}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        style={{ touchAction: "pan-y" }}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`累積R。最終 ${last.cumulative.toFixed(2)}R、${points.length}件`}
        className="w-full cursor-crosshair"
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
        {hp && (
          <>
            <line
              data-testid="cum-hover-line"
              x1={x(hp.index)}
              x2={x(hp.index)}
              y1={PAD.t}
              y2={H - PAD.b}
              className="stroke-ink-mute"
              strokeDasharray="2 3"
            />
            <circle
              cx={x(hp.index)}
              cy={y(hp.cumulative)}
              r={4}
              className="fill-accent-link stroke-bg"
              strokeWidth={2}
            />
          </>
        )}
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
      {hp && hover !== null && (
        <div
          role="status"
          data-testid="cum-tooltip"
          className="pointer-events-none absolute top-1 z-10 w-44 rounded-btn border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={
            x(hp.index) / W > 0.6
              ? { right: `${(1 - x(hp.index) / W) * 100 + 2}%` }
              : { left: `${(x(hp.index) / W) * 100 + 2}%` }
          }
        >
          {hover === 0 ? (
            <p className="font-bold text-ink">開始時点（0R）</p>
          ) : (
            <>
              <p className="font-bold text-ink">{hover}件目</p>
              <p className="text-ink-mute">
                {formatJst((hp as CumulativePoint).entryAt)}
              </p>
              <p className="mt-1 flex justify-between gap-2">
                <span className="text-ink-sub">このトレード</span>
                <span className="num">
                  {formatR((hp as CumulativePoint).r)}
                </span>
              </p>
              <p className="flex justify-between gap-2 border-t border-line pt-1 font-bold">
                <span>ここまでの累積</span>
                <span className="num">{formatR(hp.cumulative)}</span>
              </p>
            </>
          )}
        </div>
      )}
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
