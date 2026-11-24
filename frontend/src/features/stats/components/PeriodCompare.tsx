import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { Summary } from "../types";

const signed = (n: number, digits = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

function SubMetric({
  label,
  now,
  diff,
  tone,
}: {
  label: string;
  now: string;
  diff: string | null;
  tone: "up" | "down" | "flat" | "neutral";
}) {
  const toneClass =
    tone === "up"
      ? "text-profit"
      : tone === "down"
        ? "text-loss"
        : "text-ink-mute";
  return (
    <div className="rounded-card border border-line bg-surface p-2.5">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="num text-base font-bold">{now}</p>
      {diff !== null && (
        <p className={`num text-xs ${toneClass}`}>
          {tone === "up" ? "▲" : tone === "down" ? "▼" : ""} {diff}
        </p>
      )}
    </div>
  );
}

/**
 * 直前の同じ長さの期間との比較。見出し（合計損益＋前回比バッジ）を主役にし、
 * 他の指標は小さく添える。件数が少ないと動きが大きく出るので n も併記する
 */
export function PeriodCompare({
  now,
  prev,
  periodLabel,
}: {
  now: Summary;
  prev: Summary;
  periodLabel: string;
}) {
  const pnlDiff = now.totalPnlJpy - prev.totalPnlJpy;
  const pnlPct =
    prev.totalPnlJpy !== 0
      ? (pnlDiff / Math.abs(prev.totalPnlJpy)) * 100
      : null;
  const pnlTone = pnlDiff > 0 ? "up" : pnlDiff < 0 ? "down" : "flat";

  const winRateDiff =
    now.winRate === null || prev.winRate === null
      ? null
      : now.winRate - prev.winRate;
  const avgRDiff =
    now.avgR === null || prev.avgR === null ? null : now.avgR - prev.avgR;
  const pipsDiff = now.totalPips - prev.totalPips;
  const nDiff = now.n - prev.n;

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-mute">
          {periodLabel} — 前の同じ長さの期間と比較
        </h2>
        <span className="text-xs text-ink-mute">前回 n={prev.n}</span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <p
          className={`num text-3xl font-extrabold ${
            pnlTone === "up"
              ? "text-profit"
              : pnlTone === "down"
                ? "text-loss"
                : "text-ink"
          }`}
        >
          {formatYenSigned(now.totalPnlJpy)}
        </p>
        <div className="flex items-center gap-2 pb-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              pnlTone === "up"
                ? "bg-profit/10 text-profit"
                : pnlTone === "down"
                  ? "bg-loss/10 text-loss"
                  : "bg-surface text-ink-mute"
            }`}
          >
            {pnlTone === "up" ? "▲" : pnlTone === "down" ? "▼" : "±"} 前回比
            {pnlPct === null ? " —" : ` ${signed(pnlPct, 0)}%`}
          </span>
          <span className="text-xs text-ink-mute">
            （前回 {formatYenSigned(prev.totalPnlJpy)}）
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SubMetric
          label="勝率"
          now={now.winRate === null ? "—" : `${now.winRate.toFixed(1)}%`}
          diff={winRateDiff === null ? null : `${signed(winRateDiff, 1)}pt`}
          tone={
            winRateDiff === null
              ? "neutral"
              : winRateDiff > 0
                ? "up"
                : winRateDiff < 0
                  ? "down"
                  : "flat"
          }
        />
        <SubMetric
          label="平均R"
          now={formatR(now.avgR)}
          diff={avgRDiff === null ? null : signed(avgRDiff, 2)}
          tone={
            avgRDiff === null
              ? "neutral"
              : avgRDiff > 0
                ? "up"
                : avgRDiff < 0
                  ? "down"
                  : "flat"
          }
        />
        <SubMetric
          label="合計pips"
          now={formatPips(now.totalPips)}
          diff={signed(pipsDiff, 1)}
          tone={pipsDiff > 0 ? "up" : pipsDiff < 0 ? "down" : "flat"}
        />
        <SubMetric
          label="トレード数"
          now={`${now.n}件`}
          diff={signed(nDiff, 0)}
          tone="neutral"
        />
      </div>
    </section>
  );
}
