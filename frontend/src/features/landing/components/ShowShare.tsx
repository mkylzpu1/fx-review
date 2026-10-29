import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS, EMA_COLORS, SIDE_COLORS } from "@/constants/chartTheme";
import { AppWindow } from "./AppWindow";

const TFS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Tf = (typeof TFS)[number];

/** 見本の足の本数・値動きの大きさ（時間足が長いほど1本の動きが大きい） */
const SHAPE: Record<Tf, { n: number; seed: number; amp: number }> = {
  "1m": { n: 72, seed: 11, amp: 0.07 },
  "5m": { n: 60, seed: 23, amp: 0.11 },
  "15m": { n: 48, seed: 37, amp: 0.17 },
  "1h": { n: 38, seed: 41, amp: 0.26 },
  "4h": { n: 30, seed: 53, amp: 0.38 },
  "1d": { n: 24, seed: 67, amp: 0.6 },
};

const ENTRY = 150.4;
const SL = 150.2;
const TP = 150.8;
const EMAS = [20, 50] as const;

const W = 640;
const H = 250;
const PAD_R = 56;
const PAD_Y = 14;

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

/** 決まった乱数で作る見本の足。エントリー位置の終値がいつも ENTRY になるよう上下にずらす */
function sample(tf: Tf) {
  const { n, seed, amp } = SHAPE[tf];
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const inIdx = Math.round(n * 0.42);
  const outIdx = Math.round(n * 0.72);
  let p = 0;
  const raw: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    // エントリー後はTP方向へ進む形にして、計画どおりの見本にする
    const drift = i >= inIdx && i <= outIdx ? amp * 0.22 : amp * 0.02;
    const c = p + (r() - 0.5) * amp + drift;
    raw.push({
      o,
      c,
      h: Math.max(o, c) + r() * amp * 0.45,
      l: Math.min(o, c) - r() * amp * 0.45,
    });
    p = c;
  }
  const shift = ENTRY - raw[inIdx].c;
  const candles = raw.map((k) => ({
    o: k.o + shift,
    h: k.h + shift,
    l: k.l + shift,
    c: k.c + shift,
  }));
  return { candles, inIdx, outIdx };
}

function ema(candles: Candle[], period: number) {
  const a = 2 / (period + 1);
  const out: number[] = [];
  let e = candles[0].c;
  for (const k of candles) {
    e = e + (k.c - e) * a;
    out.push(e);
  }
  return out;
}

const URL_SAMPLE = "https://share.example.com/s/k3Hn8QwZ";

/** 相手に見える、公開されたチャート（時間足・EMAを切り替えられる） */
function SharedView({
  includeReasons,
  published,
  focus,
}: {
  includeReasons: boolean;
  published: boolean;
  focus: boolean;
}) {
  const [tf, setTf] = useState<Tf>("5m");
  const [emaOn, setEmaOn] = useState<Record<number, boolean>>({
    20: true,
    50: true,
  });

  const model = useMemo(() => {
    const { candles, inIdx, outIdx } = sample(tf);
    const lows = candles.map((k) => k.l).concat(SL);
    const highs = candles.map((k) => k.h).concat(TP);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const y = (v: number) =>
      PAD_Y + ((max - v) / (max - min)) * (H - PAD_Y * 2);
    const plotW = W - PAD_R;
    const step = plotW / candles.length;
    const x = (i: number) => step * (i + 0.5);
    const lines = EMAS.map((p) =>
      ema(candles, p)
        .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join(" "),
    );
    return { candles, inIdx, outIdx, y, x, step, plotW, lines };
  }, [tf]);

  const { candles, inIdx, outIdx, y, x, step, plotW, lines } = model;
  const body = Math.max(2, step * 0.6);

  return (
    <div
      className={`overflow-hidden rounded-card border bg-bg transition-colors ${
        focus ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-line bg-card px-3 py-2">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-line" />
          <span className="h-2 w-2 rounded-full bg-line" />
          <span className="h-2 w-2 rounded-full bg-line" />
        </span>
        <span className="num min-w-0 flex-1 truncate rounded-chip bg-bg px-3 py-0.5 text-[11px] text-ink-sub">
          {published ? URL_SAMPLE : "公開すると、相手に見せるURLができます"}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-bold">
            <span style={{ color: SIDE_COLORS.buy }}>買い</span> USDJPY
          </span>
          <span className="num text-xs text-ink-mute">10/21 09:42</span>
          <span className="num ml-auto flex gap-3 text-xs">
            <span style={{ color: CHART_COLORS.sl }}>SL {SL.toFixed(2)}</span>
            <span style={{ color: CHART_COLORS.tp }}>TP {TP.toFixed(2)}</span>
            <span className="text-ink-mute">RR 2.0</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div role="group" aria-label="時間足" className="flex gap-1">
            {TFS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === tf}
                onClick={() => setTf(t)}
                className={`num rounded-btn border px-2.5 py-1 text-xs ${
                  t === tf
                    ? "border-accent bg-accent/10 text-accent-link"
                    : "border-line text-ink-sub"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div role="group" aria-label="EMA" className="flex gap-1">
            {EMAS.map((p, i) => (
              <button
                key={p}
                type="button"
                aria-pressed={emaOn[p]}
                onClick={() => setEmaOn((s) => ({ ...s, [p]: !s[p] }))}
                className={`num inline-flex items-center gap-1.5 rounded-btn border px-2.5 py-1 text-xs ${
                  emaOn[p]
                    ? "border-line text-ink"
                    : "border-line text-ink-mute line-through"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-0.5 w-3 rounded"
                  style={{ background: EMA_COLORS[i] }}
                />
                EMA {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-line bg-card">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label="公開されたチャートの見本"
          >
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1="0"
                x2={plotW}
                y1={H * g}
                y2={H * g}
                stroke={CHART_COLORS.grid}
                strokeOpacity="0.5"
              />
            ))}
            {candles.map((k, i) => {
              const col = k.c >= k.o ? CHART_COLORS.up : CHART_COLORS.down;
              return (
                <g key={i}>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(k.h)}
                    y2={y(k.l)}
                    stroke={col}
                    strokeWidth="1"
                  />
                  <rect
                    x={x(i) - body / 2}
                    y={y(Math.max(k.o, k.c))}
                    width={body}
                    height={Math.max(1, Math.abs(y(k.o) - y(k.c)))}
                    fill={col}
                  />
                </g>
              );
            })}
            {EMAS.map(
              (p, i) =>
                emaOn[p] && (
                  <polyline
                    key={p}
                    points={lines[i]}
                    fill="none"
                    stroke={EMA_COLORS[i]}
                    strokeWidth="1.5"
                  />
                ),
            )}
            {(
              [
                ["TP", TP, CHART_COLORS.tp],
                ["IN", ENTRY, CHART_COLORS.entry],
                ["SL", SL, CHART_COLORS.sl],
              ] as const
            ).map(([label, v, col]) => (
              <g key={label}>
                <line
                  x1="0"
                  x2={plotW}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={col}
                  strokeWidth="1.2"
                  strokeDasharray="5 3"
                />
                <text
                  x={plotW + 6}
                  y={y(v) + 4}
                  fontSize="11"
                  fill={col}
                  className="num"
                >
                  {label} {v.toFixed(2)}
                </text>
              </g>
            ))}
            <path
              d={`M${x(inIdx)} ${y(candles[inIdx].l) + 4} l-5 9 h10 Z`}
              fill={CHART_COLORS.exit}
            />
            <path
              d={`M${x(outIdx)} ${y(candles[outIdx].h) - 4} l-5 -9 h10 Z`}
              fill={CHART_COLORS.exit}
            />
          </svg>
        </div>

        {includeReasons && (
          <section
            aria-label="根拠・メモ"
            className="space-y-1.5 rounded-card border border-line bg-surface px-3 py-2 text-xs"
          >
            <p className="flex flex-wrap items-center gap-1.5">
              <b className="mr-1">根拠・メモ</b>
              {["押し目買い", "上位足のトレンド一致"].map((t) => (
                <span
                  key={t}
                  className="rounded-chip bg-tag px-2 py-0.5 text-ink-sub"
                >
                  {t}
                </span>
              ))}
            </p>
            <p className="leading-relaxed text-ink-sub">
              <b className="text-ink">根拠メモ：</b>
              15分足の20EMAまで引きつけてからの反発を確認してエントリー。
            </p>
            <p className="leading-relaxed text-ink-sub">
              <b className="text-ink">損切りの理由：</b>
              直近の押し安値の下。割れたら、押し目の前提が崩れる。
            </p>
            <p className="leading-relaxed text-ink-sub">
              <b className="text-ink">利確の理由：</b>
              直近高値の上。RR2.0を取れる位置。
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * 実アプリの「公開してURLを作る」と、公開されたチャートの見本。
 * ボタンを押すとURLができ、右の画面（相手に見える画面）は時間足・EMAを切り替えられる
 */
export function ShowShare() {
  const [includeReasons, setIncludeReasons] = useState(true);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focus, setFocus] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const publish = () => {
    setBusy(true);
    setCopied(false);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setPublished(true);
    }, 700);
  };

  return (
    <AppWindow active="トレード" label="チャート分析を公開して共有する画面">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-5">
        <div className="space-y-3">
          <div>
            <h4 className="text-base font-bold">評価用に公開する</h4>
            <p className="mt-1 text-xs leading-relaxed text-ink-sub">
              評価をお願いする相手に、操作できるチャートを見せるURLを作ります。
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="btn-primary min-h-touch"
              disabled={busy}
              onClick={publish}
            >
              {busy ? "公開中…" : "公開してURLを作る"}
            </button>
            <label className="flex min-h-touch items-center gap-2 text-sm text-ink-sub">
              <input
                type="checkbox"
                checked={includeReasons}
                onChange={(e) => setIncludeReasons(e.target.checked)}
              />
              根拠のタグ・メモ・SL/TPの理由を含める
            </label>
          </div>

          {published && (
            <div
              className="space-y-2 rounded-card border border-line p-3"
              role="status"
              aria-label="公開したURL"
            >
              <p className="text-sm">
                公開しました。このURLを相手に送ってください。
              </p>
              <input
                readOnly
                aria-label="公開したURL"
                className="input num w-full"
                value={URL_SAMPLE}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn min-h-touch"
                  onClick={() => setCopied(true)}
                >
                  {copied ? "コピーしました" : "コピー"}
                </button>
                <button
                  type="button"
                  className="btn min-h-touch"
                  onClick={() => setFocus((f) => !f)}
                >
                  開く
                </button>
              </div>
              <p className="text-xs text-ink-sub">
                <span className="num">10/22 10:30</span>
                （24時間後）に自動で消えます。そのあとは、URLを開いても見られません。
              </p>
            </div>
          )}

          <dl className="space-y-2 rounded-card border border-line bg-surface px-3 py-2 text-xs leading-relaxed">
            <div>
              <dt className="font-bold text-profit">相手に見えるもの</dt>
              <dd className="text-ink-sub">
                チャート・EMA・SL/TP・RR（時間足・EMAは相手が自由に切り替え）
              </dd>
            </div>
            <div>
              <dt className="font-bold text-loss">共有されないもの</dt>
              <dd className="text-ink-sub">
                損益額・口座・感情タグ・振り返りの記述
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-mute">
            URLを知っている人は、誰でも24時間見られます（ログインはありません）。
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-ink-mute">相手に見える画面</p>
          <SharedView
            includeReasons={includeReasons}
            published={published}
            focus={focus}
          />
        </div>
      </div>
    </AppWindow>
  );
}
