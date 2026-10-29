import { useMemo, useState } from "react";
import { CHART_COLORS, EMA_COLORS, SIDE_COLORS } from "@/constants/chartTheme";
import { AppWindow } from "./AppWindow";

const N = 60;
const IN = 16;
const OUT = 40;
const PIP = 0.01;
const W = 760;
const H = 300;
const PLOT_W = 626;

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

/** 見本の1分足（決まった乱数なので、いつも同じ形）。値動きは 1pips=0.01 円で見せる */
function sample(): Candle[] {
  let s = 13;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const k = (v: number) => 150 + (v - 150) * 0.1;
  let p = 150;
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = p;
    const c = p + (r() - 0.5) * 0.5 + 0.05;
    out.push({
      o: k(o),
      c: k(c),
      h: k(Math.max(o, c) + r() * 0.225),
      l: k(Math.min(o, c) - r() * 0.225),
    });
    p = c;
  }
  return out;
}

type Key =
  | "entryLine"
  | "tpLine"
  | "slLine"
  | "exitLine"
  | "excursion"
  | "afterShade"
  | "markers";

const LEGEND: {
  key: Key;
  label: string;
  color: string;
  kind: "line" | "dot" | "shade" | "arrow";
}[] = [
  {
    key: "entryLine",
    label: "エントリー価格",
    color: SIDE_COLORS.buy,
    kind: "line",
  },
  { key: "tpLine", label: "TP（利確）", color: CHART_COLORS.tp, kind: "line" },
  {
    key: "slLine",
    label: "SL（損切り）",
    color: CHART_COLORS.sl,
    kind: "line",
  },
  {
    key: "exitLine",
    label: "決済価格（勝ち緑・負け赤）",
    color: CHART_COLORS.tp,
    kind: "dot",
  },
  {
    key: "excursion",
    label: "最大含み益・含み損・決済後最大",
    color: CHART_COLORS.exit,
    kind: "dot",
  },
  {
    key: "afterShade",
    label: "エントリー以降の背景",
    color: CHART_COLORS.entry,
    kind: "shade",
  },
  {
    key: "markers",
    label: "IN / OUT の矢印",
    color: CHART_COLORS.exit,
    kind: "arrow",
  },
];

function Swatch({
  kind,
  color,
}: {
  kind: "line" | "dot" | "shade" | "arrow";
  color: string;
}) {
  if (kind === "shade")
    return (
      <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12">
        <rect
          x="1"
          y="1"
          width="16"
          height="10"
          rx="2"
          fill={color}
          fillOpacity="0.35"
        />
      </svg>
    );
  if (kind === "arrow")
    return (
      <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12">
        <path d="M9 1 L15 10 L3 10 Z" fill={color} />
      </svg>
    );
  return (
    <svg aria-hidden="true" width="22" height="12" viewBox="0 0 22 12">
      <line
        x1="1"
        y1="6"
        x2="21"
        y2="6"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={kind === "line" ? "5 3" : "1.5 3"}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 右の余白に並べるラベルが重ならないよう、上下に少しずつ離す */
function spread(items: { y: number }[], gap: number) {
  const idx = items.map((_, i) => i).sort((a, b) => items[a].y - items[b].y);
  const ys = idx.map((i) => items[i].y);
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + gap);
  const out = items.map((it) => it.y);
  idx.forEach((orig, i) => (out[orig] = ys[i]));
  return out;
}

/** 実アプリのトレード詳細（チャート）。凡例を押すと線の表示・非表示を切り替えられる */
export function ShowChart() {
  const [on, setOn] = useState<Record<Key, boolean>>({
    entryLine: true,
    tpLine: true,
    slLine: true,
    exitLine: true,
    excursion: true,
    afterShade: true,
    markers: true,
  });

  const d = useMemo(() => {
    const c = sample();
    const entry = c[IN].c;
    const exit = c[OUT].c;
    const tp = entry + 16 * PIP;
    const sl = entry - 7 * PIP;
    const hold = c.slice(IN, OUT + 1);
    const mfe = Math.max(...hold.map((k) => k.h));
    const mae = Math.min(...hold.map((k) => k.l));
    const after = Math.max(...c.slice(OUT).map((k) => k.h));
    const lo = Math.min(sl, ...c.map((k) => k.l)) - 3 * PIP;
    const hi = Math.max(tp, after, ...c.map((k) => k.h)) + 3 * PIP;
    const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - 16);
    const x = (i: number) => (i + 0.5) * (PLOT_W / N);
    let e = c[0].c;
    const ema = c.map((k) => (e = e + (k.c - e) * (2 / 21)));
    const pips = (v: number) => (v / PIP).toFixed(1);
    return { c, entry, exit, tp, sl, mfe, mae, after, y, x, ema, pips };
  }, []);

  const { c, y, x } = d;
  const win = d.exit >= d.entry;
  const exitColor = win ? CHART_COLORS.tp : CHART_COLORS.sl;
  const sign = (v: number) => (v >= 0 ? `+${d.pips(v)}` : `−${d.pips(-v)}`);

  const labels = [
    on.tpLine && {
      t: `TP +${d.pips(d.tp - d.entry)}`,
      v: d.tp,
      col: CHART_COLORS.tp,
    },
    on.slLine && {
      t: `SL −${d.pips(d.entry - d.sl)}`,
      v: d.sl,
      col: CHART_COLORS.sl,
    },
    on.exitLine && {
      t: `決済 ${sign(d.exit - d.entry)}`,
      v: d.exit,
      col: exitColor,
    },
    on.entryLine && { t: "エントリー", v: d.entry, col: SIDE_COLORS.buy },
    on.excursion && {
      t: `最大含み益 ${sign(d.mfe - d.entry)}`,
      v: d.mfe,
      col: CHART_COLORS.exit,
    },
    on.excursion && {
      t: `最大含み損 ${sign(d.mae - d.entry)}`,
      v: d.mae,
      col: CHART_COLORS.exit,
    },
    on.excursion && {
      t: `決済後最大 ${sign(d.after - d.entry)}`,
      v: d.after,
      col: CHART_COLORS.exit,
    },
  ].filter(Boolean) as { t: string; v: number; col: string }[];
  const ly = spread(
    labels.map((l) => ({ y: y(l.v) })),
    13,
  );

  const line = (v: number, col: string, dash: string) => (
    <line
      x1="0"
      x2={PLOT_W}
      y1={y(v)}
      y2={y(v)}
      stroke={col}
      strokeWidth="1.4"
      strokeDasharray={dash}
    />
  );
  const emaPath = d.ema
    .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
    .join(" ");
  const afterPips = (d.after - d.exit) / PIP;

  return (
    <AppWindow
      active="トレード"
      label="トレード詳細の画面（ローソク足チャート）"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h4 className="text-base font-bold">USDJPY</h4>
        <span
          className="rounded-chip border border-line px-3 py-0.5 text-xs"
          style={{ color: SIDE_COLORS.buy }}
        >
          買い
        </span>
        <span className="num text-xs text-ink-sub">10/21 09:42 → 10:08</span>
        <span className="num ml-auto text-sm font-bold text-profit">
          {sign(d.exit - d.entry)} pips
        </span>
        <span className="num text-sm font-bold text-profit">+1.81R</span>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block min-w-[600px]"
          role="img"
          aria-label="見本のローソク足チャート"
        >
          {[0.2, 0.4, 0.6, 0.8].map((g) => (
            <line
              key={g}
              x1="0"
              x2={PLOT_W}
              y1={H * g}
              y2={H * g}
              stroke={CHART_COLORS.grid}
              strokeOpacity="0.45"
            />
          ))}
          {on.afterShade && (
            <rect
              x={x(IN)}
              y="0"
              width={PLOT_W - x(IN)}
              height={H}
              fill={CHART_COLORS.entry}
              fillOpacity="0.05"
            />
          )}
          {c.map((k, i) => {
            const up = k.c >= k.o;
            const col = up ? CHART_COLORS.up : CHART_COLORS.down;
            return (
              <g key={i}>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(k.h)}
                  y2={y(k.l)}
                  stroke={col}
                  strokeWidth="1.2"
                />
                <rect
                  x={x(i) - 3.2}
                  width="6.4"
                  y={y(Math.max(k.o, k.c))}
                  height={Math.max(1.5, Math.abs(y(k.o) - y(k.c)))}
                  fill={col}
                />
              </g>
            );
          })}
          <path
            d={emaPath}
            fill="none"
            stroke={EMA_COLORS[0]}
            strokeWidth="1.6"
            opacity="0.85"
          />
          {on.entryLine && line(d.entry, SIDE_COLORS.buy, "6 4")}
          {on.tpLine && line(d.tp, CHART_COLORS.tp, "6 4")}
          {on.slLine && line(d.sl, CHART_COLORS.sl, "6 4")}
          {on.exitLine && line(d.exit, exitColor, "2 4")}
          {on.excursion && (
            <>
              {line(d.mfe, CHART_COLORS.exit, "2 4")}
              {line(d.mae, CHART_COLORS.exit, "2 4")}
              {line(d.after, CHART_COLORS.exit, "2 4")}
            </>
          )}
          {on.markers && (
            <>
              <path
                d={`M${x(IN)} ${y(c[IN].l) + 5} l6 11 h-12 Z`}
                fill={SIDE_COLORS.buy}
              />
              <text
                x={x(IN)}
                y={y(c[IN].l) + 29}
                fontSize="10"
                fill={SIDE_COLORS.buy}
                textAnchor="middle"
                fontWeight="700"
              >
                IN
              </text>
              <path
                d={`M${x(OUT)} ${y(c[OUT].h) - 5} l6 -11 h-12 Z`}
                fill={CHART_COLORS.exit}
              />
              <text
                x={x(OUT)}
                y={y(c[OUT].h) - 20}
                fontSize="10"
                fill={CHART_COLORS.exit}
                textAnchor="middle"
                fontWeight="700"
              >
                OUT
              </text>
            </>
          )}
          {labels.map((l, i) => (
            <text
              key={l.t}
              x={PLOT_W + 8}
              y={ly[i] + 3.5}
              fontSize="10.5"
              fill={l.col}
              className="num"
            >
              {l.t}
            </text>
          ))}
        </svg>
      </div>

      <div role="group" aria-label="凡例" className="flex flex-wrap gap-1">
        {LEGEND.map((i) => (
          <button
            key={i.key}
            type="button"
            aria-pressed={on[i.key]}
            onClick={() => setOn({ ...on, [i.key]: !on[i.key] })}
            className={`inline-flex min-h-[34px] items-center gap-2 rounded-chip border border-line px-3 text-xs ${
              on[i.key]
                ? "bg-tag text-ink"
                : "text-ink-mute line-through opacity-60"
            }`}
          >
            <Swatch kind={i.kind} color={i.color} />
            {i.label}
          </button>
        ))}
      </div>

      <p className="rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink-sub">
        TPまで{d.pips(d.tp - d.mfe)} pips届かず手動で決済。その後、価格は
        <span className="num font-bold text-ink">
          {" "}
          {sign(afterPips * PIP)} pips{" "}
        </span>
        さらに伸びていました。
      </p>
    </AppWindow>
  );
}
