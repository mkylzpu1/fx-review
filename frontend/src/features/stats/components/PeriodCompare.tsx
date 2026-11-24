import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { Summary } from "../types";

const signed = (n: number, digits = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

type Tone = "up" | "down" | "flat" | "neutral";

/** 大きい数字そのものの色。前回との差分ではなく、値自体の符号で決める
 *（これを差分の符号にすると「今回マイナスでも前回よりマシだとプラス色になる」バグになる） */
const valueToneClass = (v: number | null) =>
  v === null || v === 0 ? "text-ink" : v > 0 ? "text-profit" : "text-loss";

const diffTone = (diff: number | null): Tone =>
  diff === null ? "neutral" : diff > 0 ? "up" : diff < 0 ? "down" : "flat";

const diffToneClass = (t: Tone) =>
  t === "up" ? "text-profit" : t === "down" ? "text-loss" : "text-ink-mute";

const diffArrow = (t: Tone) => (t === "up" ? "▲" : t === "down" ? "▼" : "±");

/**
 * 集計サマリー（/tradesの集計カードと同じ見た目）。
 * 前回との比較は、見出しの「前回 n=」と各指標の下の小さな差分表示でわかるようにする。
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
  const pnlDiffTone = diffTone(pnlDiff);

  const winRateDiff =
    !hasPrev || now.winRate === null || prev.winRate === null
      ? null
      : now.winRate - prev.winRate;
  const winRateDiffTone = diffTone(winRateDiff);

  const avgRDiff =
    !hasPrev || now.avgR === null || prev.avgR === null
      ? null
      : now.avgR - prev.avgR;
  const avgRDiffTone = diffTone(avgRDiff);

  const nDiff = hasPrev ? now.n - prev.n : null;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-mute">
          {hasPrev ? `${periodLabel} — 前の同じ長さの期間と比較` : periodLabel}
        </h2>
        {hasPrev ? (
          <span className="text-xs text-ink-mute">前回 n={prev.n}</span>
        ) : (
          <span className="text-xs text-ink-mute">
            比較対象の期間がありません
          </span>
        )}
      </div>

      <div
        aria-label="集計"
        className="grid overflow-hidden rounded-card border border-line bg-card md:grid-cols-4"
      >
        <div className="px-6 pb-[22px] pt-5">
          <p className="text-xs text-ink-mute">損益</p>
          <p
            className={`num mt-2 text-[32px] font-medium leading-[1.1] ${valueToneClass(now.totalPnlJpy)}`}
          >
            {formatYenSigned(now.totalPnlJpy)}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            {formatPips(now.totalPips)}
          </p>
          {hasPrev && (
            <p className={`num mt-2 text-xs ${diffToneClass(pnlDiffTone)}`}>
              {diffArrow(pnlDiffTone)} 前回比
              {pnlPct === null ? " —" : ` ${signed(pnlPct, 0)}%`}
              <span className="ml-1 text-ink-mute">
                （前回 {formatYenSigned(prev.totalPnlJpy)}）
              </span>
            </p>
          )}
        </div>

        <div className="border-t border-line px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          <p className="text-xs text-ink-mute">勝率</p>
          <p className="num mt-2 text-[32px] font-medium leading-[1.1]">
            {now.winRate === null ? "—" : `${now.winRate.toFixed(1)}%`}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            {now.n}戦{now.wins}勝{now.n - now.wins}敗
          </p>
          {hasPrev && winRateDiff !== null && (
            <p
              className={`num mt-2 text-xs ${diffToneClass(winRateDiffTone)}`}
            >
              {diffArrow(winRateDiffTone)} {signed(winRateDiff, 1)}pt
            </p>
          )}
        </div>

        <div className="border-t border-line px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          <p className="text-xs text-ink-mute">平均R</p>
          <p
            className={`num mt-2 text-[32px] font-medium leading-[1.1] ${valueToneClass(now.avgR)}`}
          >
            {formatR(now.avgR)}
          </p>
          <p className="num mt-2 text-[13px] text-ink-sub">
            PF {now.profitFactor === null ? "—" : now.profitFactor.toFixed(2)}
          </p>
          {hasPrev && avgRDiff !== null && (
            <p className={`num mt-2 text-xs ${diffToneClass(avgRDiffTone)}`}>
              {diffArrow(avgRDiffTone)} {signed(avgRDiff, 2)}
            </p>
          )}
        </div>

        <div className="border-t border-line px-6 pb-[22px] pt-5 md:border-l md:border-t-0">
          <p className="text-xs text-ink-mute">トレード数</p>
          <p className="num mt-2 text-[32px] font-medium leading-[1.1]">
            {now.n}
            <span className="text-xl text-ink-mute">件</span>
          </p>
          {hasPrev && nDiff !== null && (
            <p className="num mt-2 text-xs text-ink-mute">
              前回比 {signed(nDiff, 0)}件
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
