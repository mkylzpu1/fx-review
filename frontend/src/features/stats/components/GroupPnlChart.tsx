import { useRef, useState } from "react";
import { formatYenSigned } from "@/utils/format";
import type { GroupPnlStat } from "../types";

interface Props {
  groups: GroupPnlStat[];
}

const W = 640;
const PAD = { l: 44, r: 44, t: 22, b: 36 };
const H = 220;

/**
 * 区分ごとの損益（棒・プラス=緑/マイナス=赤）と勝率（折れ線・右軸%）。
 * 根拠タグ・感情タグ・セッション・時間帯・確信度など、区分の切り口を問わず使う。
 */
export function GroupPnlChart({ groups }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  if (groups.length === 0) return null;

  const n = groups.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / n;
  const barW = Math.min(40, slot * 0.6);

  const pnls = groups.map((g) => g.pnlJpy);
  const pLo = Math.min(0, ...pnls);
  const pHi = Math.max(0, ...pnls);
  const pSpan = pHi - pLo || 1;
  const zeroY = PAD.t + (1 - (0 - pLo) / pSpan) * plotH;
  const by = (v: number) => PAD.t + (1 - (v - pLo) / pSpan) * plotH;

  const wy = (rate: number) => PAD.t + (1 - rate) * plotH;
  const cx = (i: number) => PAD.l + slot * (i + 0.5);

  const winPath = groups
    .map((g, i) =>
      g.winRate === null ? null : `${i === 0 ? "M" : "L"}${cx(i)},${wy(g.winRate)}`,
    )
    .filter((p): p is string => p !== null)
    .join(" ");

  /** 画面上のX座標から、いちばん近い区分を選ぶ（マウス・タッチ共通） */
  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((vx - PAD.l) / slot);
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const hg = hover === null ? null : groups[hover];

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
        aria-label="区分ごとの損益と勝率"
        className="w-full cursor-crosshair"
      >
        {/* 右軸の勝率目盛（0/50/100%） */}
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={wy(r)}
              y2={wy(r)}
              className="stroke-line"
              strokeDasharray={r === 0 ? undefined : "2 3"}
              opacity={r === 0 ? 0 : 0.6}
            />
            <text
              x={W - PAD.r + 6}
              y={wy(r) + 3}
              className="fill-ink-mute text-[9px]"
            >
              {Math.round(r * 100)}%
            </text>
          </g>
        ))}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={zeroY}
          y2={zeroY}
          className="stroke-line"
        />

        {groups.map((g, i) => {
          const x = PAD.l + slot * i + (slot - barW) / 2;
          const top = by(Math.max(0, g.pnlJpy));
          const bottom = by(Math.min(0, g.pnlJpy));
          const h = Math.max(1, bottom - top);
          const dim = hover !== null && hover !== i;
          return (
            <g key={g.key}>
              {hover === i && (
                <rect
                  x={PAD.l + slot * i}
                  y={PAD.t}
                  width={slot}
                  height={plotH}
                  className="fill-ink/10"
                />
              )}
              <rect
                data-testid="group-pnl-bar"
                x={x}
                y={top}
                width={barW}
                height={h}
                rx={2}
                className={g.pnlJpy >= 0 ? "fill-profit" : "fill-loss"}
                opacity={dim ? 0.55 : 1}
              />
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-ink-mute text-[9px]"
              >
                {g.label}
              </text>
            </g>
          );
        })}

        {winPath && (
          <path
            d={winPath}
            fill="none"
            className="stroke-accent-link"
            strokeWidth={2}
          />
        )}
        {groups.map(
          (g, i) =>
            g.winRate !== null && (
              <circle
                key={g.key}
                cx={cx(i)}
                cy={wy(g.winRate)}
                r={hover === i ? 4 : 3}
                className="fill-accent-link"
              />
            ),
        )}
      </svg>
      {hg && hover !== null && (
        <div
          role="status"
          data-testid="group-pnl-tooltip"
          className="pointer-events-none absolute top-1 z-10 w-44 rounded-btn border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={
            hover / n > 0.6
              ? { right: `${(1 - (hover + 1) / n) * 100 + 2}%` }
              : { left: `${(hover / n) * 100 + 2}%` }
          }
        >
          <p className="font-bold text-ink">{hg.label}</p>
          <p className="mt-1 flex justify-between gap-2">
            <span className="text-ink-sub">損益</span>
            <span className="num font-bold">{formatYenSigned(hg.pnlJpy)}</span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-ink-sub">勝率</span>
            <span className="num">
              {hg.winRate === null ? "—" : `${(hg.winRate * 100).toFixed(1)}%`}
            </span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-ink-sub">件数</span>
            <span className="num">n={hg.n}</span>
          </p>
        </div>
      )}
      <figcaption className="text-xs text-ink-mute">
        棒=損益（緑/赤）、線=勝率（右軸）。区分ごとにn件で集計しています。
      </figcaption>
    </figure>
  );
}
