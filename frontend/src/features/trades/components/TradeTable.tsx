import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import {
  SIDE_LABEL,
  formatPips,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { Trade } from "../types";
import { MissingBadges } from "./MissingBadges";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

const pnlClass = (v: number | null) =>
  v === null
    ? "text-ink-mute"
    : v > 0
      ? "text-profit"
      : v < 0
        ? "text-loss"
        : "text-ink-sub";

const jst = (iso: string) => new Date(Date.parse(iso) + JST_OFFSET_MS);
const p2 = (n: number) => String(n).padStart(2, "0");

function dayKey(iso: string) {
  const d = jst(iso);
  return `${d.getUTCFullYear()}/${p2(d.getUTCMonth() + 1)}/${p2(d.getUTCDate())}`;
}

/** 日付ごとにまとめる（並び順は保つ） */
function groupByDay(trades: Trade[]) {
  const groups: { key: string; date: Date; items: Trade[] }[] = [];
  for (const t of trades) {
    const key = dayKey(t.entryAt);
    const last = groups.at(-1);
    if (last && last.key === key) last.items.push(t);
    else groups.push({ key, date: jst(t.entryAt), items: [t] });
  }
  return groups;
}

/** 理由・メモの要約。タグ → なければメモ本文 */
function Reason({ t }: { t: Trade }) {
  const tags = t.tags.filter((x) => x.kind === "rationale");
  const memo = t.insight || t.rationaleMemo;
  if (tags.length === 0 && !memo) return null;
  return (
    <div className="min-w-0 space-y-0.5">
      {tags.length > 0 && (
        <p className="truncate text-xs text-ink-sub">
          {tags.map((x) => x.name).join(" ・ ")}
        </p>
      )}
      {memo && <p className="truncate text-sm text-ink-mute">{memo}</p>}
    </div>
  );
}

/**
 * 枠で囲まず、罫線と余白だけで区切る一覧。行全体が押せる。
 * 買い・売りは左端の細い印と文字で示す（色だけに頼らない）。
 */
export function TradeTable({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();
  const groups = groupByDay(trades);
  return (
    <table className="w-full table-fixed text-sm">
      <thead className="sr-only">
        <tr>
          <th>時刻</th>
          <th>ペア・売買</th>
          <th>理由・メモ</th>
          <th>pips</th>
          <th>損益</th>
          <th>R</th>
          <th>状態</th>
        </tr>
      </thead>
      {groups.map((g) => {
        const done = g.items.filter((t) => t.pnlJpy !== null);
        const total = done.reduce((a, t) => a + (t.pnlJpy ?? 0), 0);
        return (
          <tbody key={g.key}>
            <tr>
              <th
                colSpan={7}
                scope="colgroup"
                className="pb-2 pt-10 text-left font-normal"
              >
                <span className="flex items-baseline gap-3">
                  <span className="num text-base text-ink">{g.key}</span>
                  <span className="text-xs text-ink-mute">
                    {WEEK[g.date.getUTCDay()]}曜日 ・ {g.items.length}件
                  </span>
                  {done.length > 0 && (
                    <span className={`num ml-auto text-sm ${pnlClass(total)}`}>
                      {formatYenSigned(total)}
                    </span>
                  )}
                </span>
              </th>
            </tr>
            {g.items.map((t) => {
              const href = ROUTES.TRADE_DETAIL.replace(":id", t.id);
              const d = jst(t.entryAt);
              return (
                <tr
                  key={t.id}
                  onClick={() => navigate(href)}
                  className="group cursor-pointer border-t border-line transition-colors hover:bg-surface/60"
                >
                  <td className="num w-16 py-4 pl-3 pr-3 text-ink-sub">
                    <a
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(href);
                      }}
                      className="hover:text-accent-link"
                    >
                      {p2(d.getUTCHours())}:{p2(d.getUTCMinutes())}
                    </a>
                  </td>
                  <td className="w-44 py-4 pr-3">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`h-5 w-0.5 ${t.side === "buy" ? "bg-accent-link" : "bg-ink-mute"}`}
                      />
                      <span className="num text-ink">{t.pair}</span>
                      <span
                        className={`text-xs ${t.side === "buy" ? "text-accent-link" : "text-ink-sub"}`}
                      >
                        {SIDE_LABEL[t.side]}
                      </span>
                      <span className="num text-xs text-ink-mute">
                        {t.lots}
                      </span>
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <Reason t={t} />
                    {(t.deviation || t.missing.length > 0) && (
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {t.deviation && (
                          <span className="text-xs text-caution">
                            ⚠ ルール逸脱
                          </span>
                        )}
                        <MissingBadges missing={t.missing} />
                      </span>
                    )}
                  </td>
                  <td
                    className={`num w-28 py-4 pr-3 text-right ${pnlClass(t.pips)}`}
                  >
                    {formatPips(t.pips)}
                  </td>
                  <td
                    className={`num w-28 py-4 pr-3 text-right text-base ${pnlClass(t.pnlJpy)}`}
                  >
                    {formatYenSigned(t.pnlJpy)}
                  </td>
                  <td className="num w-20 py-4 pr-3 text-right text-ink-sub">
                    {formatR(t.rMultiple)}
                  </td>
                  <td className="w-20 py-4 pr-3 text-right text-xs text-ink-mute">
                    {t.status === "draft" ? (
                      "下書き"
                    ) : t.status === "open" ? (
                      <span className="text-accent-link">保有中</span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100">
                        開く →
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        );
      })}
    </table>
  );
}
