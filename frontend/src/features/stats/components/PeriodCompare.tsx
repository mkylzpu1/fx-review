import { formatPips, formatR, formatYenSigned } from "@/utils/format";
import type { Summary } from "../types";

interface Row {
  label: string;
  now: string;
  prev: string;
  diff: string;
}

const signed = (n: number, digits = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

function rows(now: Summary, prev: Summary): Row[] {
  const diffOrDash = (a: number | null, b: number | null, d: number) =>
    a === null || b === null ? "—" : signed(a - b, d);
  return [
    {
      label: "勝率",
      now: now.winRate === null ? "—" : `${now.winRate.toFixed(1)}%`,
      prev: prev.winRate === null ? "—" : `${prev.winRate.toFixed(1)}%`,
      diff: diffOrDash(now.winRate, prev.winRate, 1) + "pt",
    },
    {
      label: "平均R",
      now: formatR(now.avgR),
      prev: formatR(prev.avgR),
      diff: diffOrDash(now.avgR, prev.avgR, 2),
    },
    {
      label: "合計pips",
      now: formatPips(now.totalPips),
      prev: formatPips(prev.totalPips),
      diff: signed(now.totalPips - prev.totalPips, 1),
    },
    {
      label: "合計損益",
      now: formatYenSigned(now.totalPnlJpy),
      prev: formatYenSigned(prev.totalPnlJpy),
      diff: formatYenSigned(now.totalPnlJpy - prev.totalPnlJpy),
    },
    {
      label: "トレード数",
      now: `${now.n}件`,
      prev: `${prev.n}件`,
      diff: signed(now.n - prev.n, 0),
    },
  ];
}

/** 直前の同じ長さの期間との比較。件数が少ないと動きが大きく出るので n も併記する */
export function PeriodCompare({ now, prev }: { now: Summary; prev: Summary }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold">前の期間との比較</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <caption className="sr-only">前の期間との比較</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-mute">
              <th className="py-2">指標</th>
              <th className="text-right">今の期間</th>
              <th className="text-right">前の期間</th>
              <th className="text-right">差</th>
            </tr>
          </thead>
          <tbody>
            {rows(now, prev).map((r) => (
              <tr key={r.label} className="border-b border-line">
                <td className="py-2">{r.label}</td>
                <td className="num text-right">{r.now}</td>
                <td className="num text-right">{r.prev}</td>
                <td className="num text-right">{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
