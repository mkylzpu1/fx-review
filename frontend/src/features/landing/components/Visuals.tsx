import { useMemo } from "react";

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
}

function makeCandles(n: number, seed: number, drift: number): Candle[] {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  let p = 100;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = p + (rnd() - 0.5) * 5 + drift;
    out.push({
      o,
      c,
      h: Math.max(o, c) + rnd() * 2.4,
      l: Math.min(o, c) - rnd() * 2.4,
    });
    p = c;
  }
  return out;
}

const H = 300;

interface ChartProps {
  n?: number;
  seed?: number;
  drift?: number;
  /** 買いの建てた位置と決済の位置（本数目） */
  trade?: { entry: number; exit: number };
}

/** ローソク足チャート（見た目用の見本データ） */
export function CandleChart({
  n = 56,
  seed = 7,
  drift = 0.35,
  trade,
}: ChartProps) {
  const { candles, ema, y, min, max } = useMemo(() => {
    const candles = makeCandles(n, seed, drift);
    const min = Math.min(...candles.map((c) => c.l));
    const max = Math.max(...candles.map((c) => c.h));
    const y = (v: number) => 14 + ((max - v) / (max - min)) * (H - 28);
    const ema: number[] = [];
    let e = candles[0].c;
    candles.forEach((c) => {
      e = e + (c.c - e) * 0.18;
      ema.push(e);
    });
    return { candles, ema, y, min, max };
  }, [n, seed, drift]);

  const W = n * 16;
  const x = (i: number) => i * 16 + 8;
  const emaPath = ema
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
    .join(" ");

  const mark = (i: number) => ({
    left: `${((i + 0.5) / n) * 100}%`,
    top: `${(y(candles[i].c) / H) * 100}%`,
  });

  return (
    <div className="lp-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {[0.2, 0.4, 0.6, 0.8].map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={H * g}
            y2={H * g}
            stroke="rgba(255,255,255,0.06)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? "#6EE7C8" : "#FF7A8A";
          return (
            <g key={i}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={y(c.h)}
                y2={y(c.l)}
                stroke={col}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={x(i) - 5}
                width="10"
                y={y(Math.max(c.o, c.c))}
                height={Math.max(2, Math.abs(y(c.o) - y(c.c)))}
                fill={col}
                rx="1.5"
              />
            </g>
          );
        })}
        <path
          d={emaPath}
          fill="none"
          stroke="#F5B94A"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          opacity="0.9"
        />
        {trade && (
          <line
            x1={x(trade.entry)}
            y1={y(candles[trade.entry].c)}
            x2={x(trade.exit)}
            y2={y(candles[trade.exit].c)}
            stroke="rgba(255,255,255,0.7)"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {trade && (
        <>
          <span className="lp-pin lp-pin-in" style={mark(trade.entry)}>
            <i />
            <b>買い</b>
          </span>
          <span className="lp-pin lp-pin-out" style={mark(trade.exit)}>
            <i />
            <b>決済</b>
          </span>
        </>
      )}
      <span className="lp-chart-axis num" aria-hidden="true">
        {max.toFixed(0)}
        <br />
        {min.toFixed(0)}
      </span>
    </div>
  );
}

const SIDE = ["統計", "トレード", "ルール", "学習メモ", "エクスポート"];

/** ヒーローで見せる、アプリ画面の見本 */
export function AppWindow() {
  return (
    <div className="lp-window" aria-hidden="true">
      <div className="lp-window-bar">
        <i style={{ background: "#ff5f57" }} />
        <i style={{ background: "#febc2e" }} />
        <i style={{ background: "#28c840" }} />
        <span>FXレビュー</span>
      </div>
      <div className="lp-window-body">
        <aside className="lp-window-side">
          {SIDE.map((s, i) => (
            <span key={s} data-on={i === 1}>
              {s}
            </span>
          ))}
        </aside>
        <div className="lp-window-main">
          <div className="lp-stats">
            <div>
              <small>勝率</small>
              <b className="num">58%</b>
            </div>
            <div>
              <small>今月の損益</small>
              <b className="num text-profit">+184.6 pips</b>
            </div>
            <div>
              <small>ルールを守れた率</small>
              <b className="num">82%</b>
            </div>
          </div>
          <div className="lp-window-chart">
            <div className="lp-window-chart-head">
              <b>USDJPY</b>
              <span>15分足</span>
            </div>
            <div className="lp-reveal-x">
              <CandleChart
                seed={11}
                drift={0.4}
                trade={{ entry: 14, exit: 41 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportVisual() {
  const rows = [
    ["USDJPY", "買い", "+12.4", true],
    ["EURUSD", "売り", "−8.1", false],
    ["GBPJPY", "買い", "+21.7", true],
    ["XAUUSD", "売り", "+5.3", true],
  ] as const;
  return (
    <div className="lp-vis lp-import" aria-hidden="true">
      <div className="lp-file">history.csv</div>
      <div className="lp-rows">
        {rows.map(([pair, side, pips, win], i) => (
          <div key={pair} className="lp-row" style={{ ["--i" as string]: i }}>
            <b>{pair}</b>
            <span>{side}</span>
            <em className={`num ${win ? "text-profit" : "text-loss"}`}>
              {pips}
            </em>
          </div>
        ))}
      </div>
      <div className="lp-done">4件を取り込みました</div>
    </div>
  );
}

export function ReviewVisual() {
  return (
    <div className="lp-vis lp-review" aria-hidden="true">
      <div className="lp-reveal-x">
        <CandleChart
          n={64}
          seed={23}
          drift={0.25}
          trade={{ entry: 20, exit: 47 }}
        />
      </div>
    </div>
  );
}

export function RulesVisual() {
  const items = [
    ["損切りを入れた", true],
    ["ロットは決めた範囲内", true],
    ["指標の前は見送る", false],
    ["1日2回まで", true],
  ] as const;
  return (
    <ul className="lp-vis lp-rules" aria-hidden="true">
      {items.map(([t, ok], i) => (
        <li key={t} data-ok={ok} style={{ ["--i" as string]: i }}>
          <span className="lp-tick">{ok ? "✓" : "×"}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function WeeklyVisual() {
  const bars = [38, -22, 64, 20, -12, 78, 46];
  const days = ["月", "火", "水", "木", "金", "土", "日"];
  return (
    <div className="lp-vis lp-weekly" aria-hidden="true">
      {bars.map((b, i) => (
        <div key={i} className="lp-bar-col">
          <div className="lp-bar-area">
            <div
              className="lp-bar"
              data-loss={b < 0}
              style={{
                ["--h" as string]: `${Math.abs(b)}%`,
                ["--i" as string]: i,
                [b < 0 ? "top" : "bottom"]: "50%",
              }}
            />
          </div>
          <small>{days[i]}</small>
        </div>
      ))}
    </div>
  );
}

export function AiVisual() {
  return (
    <div className="lp-vis lp-ai" aria-hidden="true">
      <p className="lp-bubble lp-bubble-me" style={{ ["--i" as string]: 0 }}>
        今週の記録を貼りました。直すべき点は？
      </p>
      <p className="lp-bubble lp-bubble-ai" style={{ ["--i" as string]: 1 }}>
        損失の多くが、損切りを入れなかったトレードに集中しています。
      </p>
    </div>
  );
}
