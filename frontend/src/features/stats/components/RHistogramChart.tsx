import type { RHistogramBin } from "../types";

interface Props {
  bins: RHistogramBin[];
}

const W = 640;
const PAD = { l: 36, r: 12, t: 8, b: 28 };
const H = 160;

/** 負けの区切りは赤、勝ちの区切りは緑、0Rは中間色 */
function toneOf(key: string): string {
  if (key === "0") return "fill-ink-mute";
  return key.startsWith("-") || key === "le-2" ? "fill-loss" : "fill-profit";
}

/** Rの分布（-2R以下〜3R以上の区切りごとの件数）。利確が伸ばせているか・損切りが計画通りかを見る棒グラフ */
export function RHistogramChart({ bins }: Props) {
  const total = bins.reduce((a, b) => a + b.count, 0);
  if (total === 0) return null;

  const n = bins.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / n;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const barW = Math.min(44, slot * 0.7);
  const y = (count: number) => PAD.t + (1 - count / max) * plotH;

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Rの分布。合計${total}件`}
        className="w-full"
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
          return (
            <g key={b.key}>
              {b.count > 0 && (
                <rect
                  x={x}
                  y={top}
                  width={barW}
                  height={h}
                  className={toneOf(b.key)}
                  rx={2}
                />
              )}
              {b.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={top - 4}
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
      <figcaption className="text-xs text-ink-mute">
        R が計算できた{total}件の分布です。右に偏っていれば利を伸ばせている、
        -1R付近(計画通りの損切り)に偏っていれば損切りを計画通りに実行できています。
      </figcaption>
    </figure>
  );
}
