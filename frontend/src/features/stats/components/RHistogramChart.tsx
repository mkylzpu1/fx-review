import { useRef, useState } from "react";
import type { RHistogramBin } from "../types";

interface Props {
  bins: RHistogramBin[];
}

const W = 640;
const PAD = { l: 36, r: 12, t: 28, b: 28 };
const H = 190;

/** 負けの区切りは赤、勝ちの区切りは緑、0Rは中間色 */
function toneOf(key: string): string {
  if (key === "0") return "fill-ink-mute";
  return key.startsWith("-") || key === "le-2" ? "fill-loss" : "fill-profit";
}

/** Rの分布（-2R以下〜3R以上の区切りごとの件数）。利確が伸ばせているか・損切りが計画通りかを見る棒グラフ */
export function RHistogramChart({ bins }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const total = bins.reduce((a, b) => a + b.count, 0);
  if (total === 0) return null;

  const n = bins.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / n;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const barW = Math.min(44, slot * 0.7);
  const y = (count: number) => PAD.t + (1 - count / max) * plotH;

  /** 画面上のX座標から、いちばん近い区切りを選ぶ（マウス・タッチ共通） */
  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((vx - PAD.l) / slot);
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const hb = hover === null ? null : bins[hover];

  return (
    <figure className="relative space-y-2">
      <svg
        ref={svgRef}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        style={{ touchAction: "pan-y" }}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Rの分布。合計${total}件`}
        className="w-full cursor-crosshair"
      >
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + plotH}
          y2={PAD.t + plotH}
          className="stroke-line"
        />
        {bins.map((b, i) => {
          const x = PAD.l + slot * i + (slot - barW) / 2;
          const top = y(b.count);
          const h = Math.max(b.count > 0 ? 2 : 0, PAD.t + plotH - top);
          const dim = hover !== null && hover !== i;
          return (
            <g key={b.key}>
              {hover === i && (
                <rect
                  data-testid="r-hist-hover-guide"
                  x={PAD.l + slot * i}
                  y={0}
                  width={slot}
                  height={plotH + PAD.t}
                  className="fill-ink/10"
                />
              )}
              {b.count > 0 && (
                <rect
                  data-testid="r-hist-bar"
                  x={x}
                  y={top}
                  width={barW}
                  height={h}
                  rx={2}
                  className={toneOf(b.key)}
                  opacity={dim ? 0.55 : 1}
                />
              )}
              {b.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={top - 6}
                  textAnchor="middle"
                  className="num fill-ink-mute text-[10px]"
                >
                  {b.count}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-ink-mute text-[9px]"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hb && hover !== null && (
        <div
          role="status"
          data-testid="r-hist-tooltip"
          className="pointer-events-none absolute top-1 z-10 w-40 rounded-btn border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={
            hover / n > 0.6
              ? { right: `${(1 - (hover + 1) / n) * 100 + 2}%` }
              : { left: `${(hover / n) * 100 + 2}%` }
          }
        >
          <p className="font-bold text-ink">{hb.label}</p>
          <p className="mt-1 flex justify-between gap-2">
            <span className="text-ink-sub">件数</span>
            <span className="num font-bold">{hb.count}件</span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-ink-sub">割合</span>
            <span className="num">
              {total === 0 ? "—" : `${((hb.count / total) * 100).toFixed(1)}%`}
            </span>
          </p>
        </div>
      )}
      <figcaption className="text-xs text-ink-mute">
        R が計算できた{total}件の分布です。右に偏っていれば利を伸ばせている、
        -1R付近(計画通りの損切り)に偏っていれば損切りを計画通りに実行できています。
      </figcaption>
    </figure>
  );
}
