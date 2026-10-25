import { useEffect, useRef, useState } from "react";
import type { Timeframe } from "@/features/settings/types";
import { TF_SECONDS } from "../utils/chartRange";
import { useCandles } from "../hooks/useCandles";
import type { Trade } from "../types";

const W = 220;
const H = 64;
const PAD = 4;
const TFS: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const TARGET_BARS = 60;

/** 保有時間（前後に同じだけ余白）が60本前後に収まる時間足を選ぶ */
export function pickTf(spanSec: number): Timeframe {
  return TFS.find((tf) => spanSec / TF_SECONDS[tf] <= TARGET_BARS) ?? "1d";
}

export function miniRange(trade: Pick<Trade, "entryAt" | "exitAt">) {
  const entry = Date.parse(trade.entryAt);
  const exit = trade.exitAt ? Date.parse(trade.exitAt) : Date.now();
  const hold = Math.max(15 * 60_000, exit - entry);
  const pad = hold * 0.5;
  const spanSec = (hold + pad * 2) / 1000;
  const tf = pickTf(spanSec);
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
export function MiniChart({ trade }: { trade: Trade }) {
  const { ref, seen } = useVisible();
  const m = miniRange(trade);
  const { data, isError } = useCandles(m.tf, seen ? m.range : null);

  const frame = "h-16 w-[220px] shrink-0";
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

  const levels = [
    trade.slPrice,
    trade.tpPrice,
    trade.entryPrice,
    trade.exitPrice,
  ].filter((v): v is number => v !== null);
  const closes = candles.map((c) => c.close);
  const hi = Math.max(...candles.map((c) => c.high), ...levels);
  const lo = Math.min(...candles.map((c) => c.low), ...levels);
  const t0 = candles[0].time;
  const t1 = candles[candles.length - 1].time;
  const x = (t: number) =>
    PAD +
    ((Math.min(Math.max(t, t0), t1) - t0) / Math.max(1, t1 - t0)) *
      (W - PAD * 2);
  const y = (v: number) =>
    PAD + ((hi - v) / Math.max(1e-9, hi - lo)) * (H - PAD * 2);
  const path = candles
    .map(
      (c, i) =>
        `${i === 0 ? "M" : "L"}${x(c.time).toFixed(1)} ${y(closes[i]).toFixed(1)}`,
    )
    .join("");
  const win = (trade.pnlJpy ?? 0) >= 0;
  const stroke =
    trade.pnlJpy === null ? "#9DB4FF" : win ? "#6EE7C8" : "#FF7A8A";

  return (
    <div ref={ref} className={frame}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${trade.pair}の値動き（${m.tf}足）`}
      >
        {trade.tpPrice !== null && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(trade.tpPrice)}
            y2={y(trade.tpPrice)}
            stroke="#6EE7C8"
            strokeOpacity=".45"
            strokeDasharray="3 3"
          />
        )}
        {trade.slPrice !== null && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(trade.slPrice)}
            y2={y(trade.slPrice)}
            stroke="#FF7A8A"
            strokeOpacity=".45"
            strokeDasharray="3 3"
          />
        )}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(trade.entryPrice)}
          y2={y(trade.entryPrice)}
          stroke="#8B95A5"
          strokeOpacity=".4"
        />
        <path
          d={path}
          fill="none"
          stroke="#B4BDCA"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle
          cx={x(m.entry)}
          cy={y(trade.entryPrice)}
          r="3.5"
          fill="#3E63DD"
          stroke="#E6EAF0"
          strokeWidth="1"
        />
        {m.exit !== null && trade.exitPrice !== null && (
          <circle
            cx={x(m.exit)}
            cy={y(trade.exitPrice)}
            r="3.5"
            fill={stroke}
            stroke="#0E1116"
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
}
