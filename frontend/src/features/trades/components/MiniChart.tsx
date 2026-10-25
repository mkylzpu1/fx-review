import { useEffect, useRef, useState } from "react";
import type { Timeframe } from "@/features/settings/types";
import { TF_SECONDS } from "../utils/chartRange";
import { useCandles } from "../hooks/useCandles";
import type { Trade } from "../types";

const W = 148;
const H = 44;
const PAD = 3;
const TFS: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const TARGET_BARS = 60;
/** 時間足を固定したとき、1本のチャートに入れる足の最大数 */
const MAX_BARS = 240;
/** 時間足を固定したとき、最低でもこの本数ぶんは前後に余白を取る */
const MIN_PAD_BARS = 6;

/** 一覧のチャートの時間足。auto は保有時間に合わせて行ごとに選ぶ */
export type MiniTf = "auto" | Timeframe;

/** 保有時間（前後に同じだけ余白）が60本前後に収まる時間足を選ぶ */
export function pickTf(spanSec: number): Timeframe {
  return TFS.find((tf) => spanSec / TF_SECONDS[tf] <= TARGET_BARS) ?? "1d";
}

export function miniRange(
  trade: Pick<Trade, "entryAt" | "exitAt">,
  tfChoice: MiniTf = "auto",
) {
  const entry = Date.parse(trade.entryAt);
  const exit = trade.exitAt ? Date.parse(trade.exitAt) : Date.now();
  const hold = Math.max(15 * 60_000, exit - entry);
  if (tfChoice === "auto") {
    const pad = hold * 0.5;
    const tf = pickTf((hold + pad * 2) / 1000);
    return {
      tf,
      entry: entry / 1000,
      exit: trade.exitAt ? exit / 1000 : null,
      range: {
        from: new Date(entry - pad).toISOString(),
        to: new Date(exit + pad).toISOString(),
        warmup: 0,
      },
    };
  }
  // 時間足を固定: 余白は保有時間の半分か数本ぶんの長いほう。長すぎれば決済側の MAX_BARS 本に絞る
  const barMs = TF_SECONDS[tfChoice] * 1000;
  const pad = Math.max(hold * 0.5, barMs * MIN_PAD_BARS);
  const to = exit + pad;
  const from = Math.max(entry - pad, to - barMs * MAX_BARS);
  return {
    tf: tfChoice,
    entry: entry / 1000,
    exit: trade.exitAt ? exit / 1000 : null,
    range: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      warmup: 0,
    },
  };
}

/** 画面に入ってから読み込む（一覧の全行を一度に取りに行かない） */
function useVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

/** 一覧用の小さな値動き。終値の折れ線に、エントリー・決済・SL・TPを重ねる */
export function MiniChart({
  trade,
  tf = "auto",
}: {
  trade: Trade;
  tf?: MiniTf;
}) {
  const { ref, seen } = useVisible();
  const m = miniRange(trade, tf);
  const { data, isError } = useCandles(m.tf, seen ? m.range : null);

  const frame = "h-11 w-[148px] shrink-0";
  const candles = data?.candles ?? [];
  if (!seen || (!data && !isError))
    return (
      <div
        ref={ref}
        className={`${frame} animate-pulse rounded-btn bg-surface/60`}
      />
    );
  if (isError || candles.length < 2)
    return (
      <div
        ref={ref}
        className={`${frame} grid place-items-center rounded-btn border border-dashed border-line text-xs text-ink-mute`}
      >
        足データなし
      </div>
    );

  // 縦の範囲は値動きとエントリー・決済に合わせる（SL・TPが遠くても波形を潰さない）
  const levels = [trade.entryPrice, trade.exitPrice].filter(
    (v): v is number => v !== null,
  );
  const closes = candles.map((c) => c.close);
  const hi = Math.max(...closes, ...levels);
  const lo = Math.min(...closes, ...levels);
  const within = (v: number | null): v is number =>
    v !== null && v >= lo && v <= hi;
  const t0 = candles[0].time;
  const t1 = candles[candles.length - 1].time;
  const x = (t: number) =>
    PAD +
    ((Math.min(Math.max(t, t0), t1) - t0) / Math.max(1, t1 - t0)) *
      (W - PAD * 2);
  const y = (v: number) =>
    PAD + ((hi - v) / Math.max(1e-9, hi - lo)) * (H - PAD * 2);
  const win = (trade.pnlJpy ?? 0) >= 0;
  const stroke =
    trade.pnlJpy === null ? "#9DB4FF" : win ? "#6EE7C8" : "#FF7A8A";
  const fill =
    trade.pnlJpy === null
      ? "rgba(157,180,255,.12)"
      : win
        ? "rgba(110,231,200,.12)"
        : "rgba(255,122,138,.12)";
  const pts = candles.map(
    (c, i) => `${x(c.time).toFixed(1)},${y(closes[i]).toFixed(1)}`,
  );
  const line = pts.join(" ");
  const area = `${x(t0).toFixed(1)},${H} ${line} ${x(t1).toFixed(1)},${H}`;
  const inside = (t: number) => t >= t0 && t <= t1;

  return (
    <div ref={ref} className={frame}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${trade.pair}の値動き（${m.tf}足）`}
      >
        {within(trade.tpPrice) && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(trade.tpPrice)}
            y2={y(trade.tpPrice)}
            stroke="#6EE7C8"
            strokeOpacity=".4"
            strokeDasharray="3 3"
          />
        )}
        {within(trade.slPrice) && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(trade.slPrice)}
            y2={y(trade.slPrice)}
            stroke="#FF7A8A"
            strokeOpacity=".4"
            strokeDasharray="3 3"
          />
        )}
        <polygon points={area} fill={fill} />
        <polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {inside(m.entry) && (
          <circle
            cx={x(m.entry)}
            cy={y(trade.entryPrice)}
            r="3"
            fill="#3E63DD"
            stroke="#E6EAF0"
            strokeWidth="1"
          />
        )}
        {m.exit !== null && trade.exitPrice !== null && inside(m.exit) && (
          <circle
            cx={x(m.exit)}
            cy={y(trade.exitPrice)}
            r="3"
            fill={stroke}
            stroke="#0E1116"
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
}
