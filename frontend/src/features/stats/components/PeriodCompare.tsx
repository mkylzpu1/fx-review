import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { Summary } from "../types";

const signed = (n: number, digits = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

/** 比較相手が無いときの色づけ：値そのものの符号で、プラス=up・マイナス=down */
const signTone = (v: number | null): "up" | "down" | "flat" | "neutral" =>
  v === null ? "neutral" : v > 0 ? "up" : v < 0 ? "down" : "flat";

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
      <p
        className={`num text-base font-bold ${
          diff === null && tone !== "neutral" ? toneClass : ""
        }`}
      >
        {now}
      </p>
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
  prev: Summary | null;
  periodLabel: string;
}) {
  const hasPrev = prev !== null;
  const pnlDiff = hasPrev ? now.totalPnlJpy - prev.totalPnlJpy : null;
  const pnlPct =
    hasPrev && prev.totalPnlJpy !== 0 && pnlDiff !== null
      ? (pnlDiff / Math.abs(prev.totalPnlJpy)) * 100
      : null;
  const pnlTone = hasPrev
    ? pnlDiff! > 0
      ? "up"
      : pnlDiff! < 0
        ? "down"
        : "flat"
    : signTone(now.totalPnlJpy);

  const winRateDiff =
    !hasPrev || now.winRate === null || prev.winRate === null
      ? null
      : now.winRate - prev.winRate;
  const avgRDiff =
    !hasPrev || now.avgR === null || prev.avgR === null
      ? null
      : now.avgR - prev.avgR;
  const avgRTone = hasPrev
    ? avgRDiff === null
      ? "neutral"
      : avgRDiff > 0
        ? "up"
        : avgRDiff < 0
          ? "down"
          : "flat"
    : signTone(now.avgR);
  const pipsDiff = hasPrev ? now.totalPips - prev.totalPips : null;
  const pipsTone = hasPrev
    ? pipsDiff! > 0
      ? "up"
      : pipsDiff! < 0
        ? "down"
        : "flat"
    : signTone(now.totalPips);
  const nDiff = hasPrev ? now.n - prev.n : null;

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-mute">
          {hasPrev ? `${periodLabel} — 前の同じ長さの期間と比較` : periodLabel}
        </h2>
        {hasPrev ? (
          <span className="text-xs text-ink-mute">前回 n={prev.n}</span>
        ) : (
          <span className="text-xs text-ink-mute">比較対象の期間がありません</span>
        )}
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
        {hasPrev && (
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
        )}
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
          tone={avgRTone}
        />
        <SubMetric
          label="合計pips"
          now={formatPips(now.totalPips)}
          diff={pipsDiff === null ? null : signed(pipsDiff, 1)}
          tone={pipsTone}
        />
        <SubMetric
          label="トレード数"
          now={`${now.n}件`}
          diff={nDiff === null ? null : signed(nDiff, 0)}
          tone="neutral"
        />
      </div>
    </section>
  );
}
