import { formatR } from "@/utils/format";
import type { GroupStat, Verdict } from "../types";

const VERDICT: Record<Verdict, string> = {
  strength: "強み",
  weakness: "弱み",
  needs_check: "要検証",
};

/** 区分ごとの平均R。n は必ず併記する。強み・弱みは文字でも示す */
export function GroupTable({
  title,
  groups,
}: {
  title: string;
  groups: GroupStat[];
}) {
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold">{title}</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-mute">
          Rが計算できるトレードがまだありません。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-mute">
                <th className="py-2">区分</th>
                <th className="text-right">平均R</th>
                <th className="text-right">n</th>
                <th className="pl-3">判定</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key} className="border-b border-line">
                  <td className="py-2">{g.label}</td>
                  <td className="num text-right">{formatR(g.avgR)}</td>
                  <td className="num text-right">n={g.n}</td>
                  <td className="pl-3 text-xs text-ink-sub">
                    {VERDICT[g.verdict]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
