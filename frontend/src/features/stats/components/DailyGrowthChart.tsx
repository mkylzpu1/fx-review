import { useRef, useState } from "react";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import type { DailyPoint } from "../types";
import {
  DAILY_METRICS,
  cumulativeValue,
  dayCounts,
  dayValue,
  formatAxis,
  formatMetric,
  fullDate,
  shortDate,
  type DailyMetric,
} from "../utils/daily";

interface Props {
  daily: DailyPoint[];
}

const W = 640;
const PAD = { l: 52, r: 12 };
const LINE = { t: 12, h: 110 };
const BAR = { t: LINE.t + LINE.h + 22, h: 70 };
const H = BAR.t + BAR.h + 22;

/**
 * 日々の成長。上: その日までの累積の折れ線、下: 日ごとの棒（プラス=緑・マイナス=赤）。
 * 取引のあった日だけを横に並べ、円／pips／R を切り替えられる。
 */
export function DailyGrowthChart({ daily }: Props) {
  const [metric, setMetric] = useState<DailyMetric>("pnl");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  if (daily.length === 0) return null;

  const n = daily.length;
  const plotW = W - PAD.l - PAD.r;
  const slot = plotW / n;
  const cx = (i: number) => PAD.l + slot * (i + 0.5);

  const cum = daily.map((d) => cumulativeValue(d, metric));
  const cLo = Math.min(0, ...cum);
  const cHi = Math.max(0, ...cum);
  const cSpan = cHi - cLo || 1;
  const cy = (v: number) => LINE.t + (1 - (v - cLo) / cSpan) * LINE.h;
  const path = cum
    .map((v, i) => `${i === 0 ? "M" : "L"}${cx(i)},${cy(v)}`)
    .join(" ");
  const lastCum = cum[n - 1];

  const vals = daily.map((d) => dayValue(d, metric));
  const nums = vals.filter((v): v is number => v !== null);
  const bLo = Math.min(0, ...nums);
  const bHi = Math.max(0, ...nums);
  const bSpan = bHi - bLo || 1;
  const by = (v: number) => BAR.t + (1 - (v - bLo) / bSpan) * BAR.h;
  const barW = Math.min(28, Math.max(2, slot * 0.7));

  /** 画面上のX座標から、いちばん近い日を選ぶ（マウス・タッチ共通） */
  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((vx - PAD.l) / slot);
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const hi_ = hover !== null && hover < n ? hover : null;
  const hd = hi_ === null ? null : daily[hi_];

  const { plus, minus } = dayCounts(daily, metric);
  const tone =
    lastCum > 0 ? "text-profit" : lastCum < 0 ? "text-loss" : "text-ink";
  // 日付ラベルは混み合わないよう間引く
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <figure className="space-y-2" data-testid="daily-growth">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="表示する指標"
          value={metric}
          options={DAILY_METRICS.map((m) => ({ value: m.key, label: m.label }))}
          onChange={setMetric}
        />
        <p className="text-sm">
          累積{" "}
          <span className={`num font-bold ${tone}`}>
            {formatMetric(lastCum, metric)}
          </span>
          <span className="ml-2 text-xs text-ink-mute">
            {n}日（プラス{plus}日・マイナス{minus}日）
          </span>
        </p>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          onMouseMove={(e) => pick(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => pick(e.touches[0].clientX)}
          onTouchMove={(e) => pick(e.touches[0].clientX)}
          style={{ touchAction: "pan-y" }}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`日々の成長。${n}日で累積 ${formatMetric(lastCum, metric)}`}
          className="w-full cursor-crosshair"
        >
          {/* ホバー中の日のガイド */}
          {hi_ !== null && (
            <rect
              data-testid="hover-guide"
              x={PAD.l + slot * hi_}
              y={LINE.t}
              width={slot}
              height={BAR.t + BAR.h - LINE.t}
              className="fill-ink/10"
            />
          )}
          {/* 累積の折れ線 */}
          <text x={PAD.l} y={LINE.t - 2} className="fill-ink-mute text-[10px]">
            累積
          </text>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={cy(0)}
            y2={cy(0)}
            className="stroke-line"
            strokeDasharray="4 4"
          />
          <path
            data-testid="cumulative-line"
            d={path}
            fill="none"
            className="stroke-accent-link"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {hi_ !== null && (
            <circle
              cx={cx(hi_)}
              cy={cy(cum[hi_])}
              r={4}
              className="fill-accent-link stroke-bg"
              strokeWidth={2}
            />
          )}
          {n === 1 && hi_ === null && (
            <circle
              cx={cx(0)}
              cy={cy(cum[0])}
              r={3}
              className="fill-accent-link"
            />
          )}
          <text
            x={PAD.l - 6}
            y={cy(cHi) + 4}
            textAnchor="end"
            className="num fill-ink-mute text-[10px]"
          >
            {formatAxis(cHi, metric)}
          </text>
          <text
            x={PAD.l - 6}
            y={cy(cLo) + 4}
            textAnchor="end"
            className="num fill-ink-mute text-[10px]"
          >
            {formatAxis(cLo, metric)}
          </text>

          {/* 日ごとの棒 */}
          <text x={PAD.l} y={BAR.t - 8} className="fill-ink-mute text-[10px]">
            その日の成績
          </text>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={by(0)}
            y2={by(0)}
            className="stroke-line"
          />
          {daily.map((d, i) => {
            const v = vals[i];
            if (v === null || v === 0) return null;
            const top = Math.min(by(v), by(0));
            const h = Math.max(1, Math.abs(by(v) - by(0)));
            return (
              <rect
                key={d.date}
                data-testid="day-bar"
                x={cx(i) - barW / 2}
                y={top}
                width={barW}
                height={h}
                className={v > 0 ? "fill-profit" : "fill-loss"}
                opacity={hi_ === null || hi_ === i ? 1 : 0.55}
              ></rect>
            );
          })}
          <text
            x={PAD.l - 6}
            y={by(bHi) + 4}
            textAnchor="end"
            className="num fill-ink-mute text-[10px]"
          >
            {formatAxis(bHi, metric)}
          </text>
          <text
            x={PAD.l - 6}
            y={by(bLo) + 4}
            textAnchor="end"
            className="num fill-ink-mute text-[10px]"
          >
            {formatAxis(bLo, metric)}
          </text>

          {/* 日付 */}
          {daily.map((d, i) =>
            i % step === 0 || i === n - 1 ? (
              <text
                key={d.date}
                x={cx(i)}
                y={H - 6}
                textAnchor="middle"
                className="num fill-ink-mute text-[10px]"
              >
                {shortDate(d.date)}
              </text>
            ) : null,
          )}
        </svg>
        {hd && hi_ !== null && (
          <div
            role="status"
            data-testid="daily-tooltip"
            className="pointer-events-none absolute top-1 z-10 w-44 rounded-btn border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={
              cx(hi_) / W > 0.6
                ? { right: `${(1 - cx(hi_) / W) * 100 + 2}%` }
                : { left: `${(cx(hi_) / W) * 100 + 2}%` }
            }
          >
            <p className="font-bold text-ink">{fullDate(hd.date)}</p>
            <p className="text-ink-mute">
              {hd.n}件（勝ち{hd.wins}・負け{hd.n - hd.wins}）
            </p>
            <dl className="mt-1 space-y-0.5">
              {DAILY_METRICS.map((m) => {
                const v = dayValue(hd, m.key);
                const tone =
                  v === null || v === 0
                    ? "text-ink"
                    : v > 0
                      ? "text-profit"
                      : "text-loss";
                return (
                  <div
                    key={m.key}
                    className={`flex justify-between gap-2 ${
                      m.key === metric ? "font-bold" : "text-ink-sub"
                    }`}
                  >
                    <dt>{m.key === "pnl" ? "損益" : m.label}</dt>
                    <dd className={`num ${tone}`}>{formatMetric(v, m.key)}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-1 flex justify-between gap-2 border-t border-line pt-1">
              <span className="text-ink-mute">ここまでの累積</span>
              <span className="num font-bold text-ink">
                {formatMetric(cum[hi_], metric)}
              </span>
            </p>
          </div>
        )}
      </div>
      <figcaption className="text-xs text-ink-mute">
        取引のあった日だけを並べています。図にカーソルを合わせる（スマホは触れる）と、その日の詳細が出ます。
        {metric === "r" && "R が計算できた取引が無い日は棒を出していません。"}
      </figcaption>
    </figure>
  );
}
