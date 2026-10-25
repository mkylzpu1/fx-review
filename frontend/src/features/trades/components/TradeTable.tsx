import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import {
  SIDE_LABEL,
  formatPips,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { Trade } from "../types";
import { MiniChart } from "./MiniChart";
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
  const tags = (t.tags ?? []).filter((x) => x.kind === "rationale");
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
    <div role="table" aria-label="トレード一覧" className="space-y-8">
      {groups.map((g) => {
        const done = g.items.filter((t) => t.pnlJpy !== null);
        const total = done.reduce((a, t) => a + (t.pnlJpy ?? 0), 0);
        return (
          <section key={g.key} role="rowgroup" aria-label={g.key}>
            <div className="mb-2 flex items-baseline gap-3 px-1">
              <span className="num text-base text-ink">{g.key}</span>
              <span className="text-xs text-ink-mute">
                {WEEK[g.date.getUTCDay()]}曜日 ・ {g.items.length}件
              </span>
              {done.length > 0 && (
                <span className={`num ml-auto text-sm ${pnlClass(total)}`}>
                  {formatYenSigned(total)}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {g.items.map((t) => {
                const href = ROUTES.TRADE_DETAIL.replace(":id", t.id);
                const d = jst(t.entryAt);
                const buy = t.side === "buy";
                return (
                  <div
                    key={t.id}
                    role="row"
                    onClick={() => navigate(href)}
                    className="flex cursor-pointer items-center gap-5 rounded-card border border-line bg-card px-5 py-3 transition-colors hover:border-field hover:bg-surface"
                  >
                    <div role="cell" className="w-40 shrink-0 space-y-1">
                      <p className="flex items-center gap-2">
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(href);
                          }}
                          className="num text-ink-sub hover:text-accent-link"
                        >
                          {p2(d.getUTCHours())}:{p2(d.getUTCMinutes())}
                        </a>
                        {t.status === "draft" && (
                          <span className="text-xs text-ink-mute">下書き</span>
                        )}
                        {t.status === "open" && (
                          <span className="text-xs text-accent-link">
                            保有中
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="num text-ink">{t.pair}</span>
                        <span
                          className={`rounded-chip px-2 py-0.5 text-xs ${buy ? "bg-[#1C2A52] text-[#B7C8FF]" : "bg-[#2B2447] text-[#D6CBFF]"}`}
                        >
                          {SIDE_LABEL[t.side]}
                        </span>
                        <span className="num text-xs text-ink-mute">
                          {t.lots}
                        </span>
                      </p>
                    </div>
                    <div role="cell">
                      <MiniChart trade={t} />
                    </div>
                    <div role="cell" className="min-w-0 flex-1 space-y-1">
                      <Reason t={t} />
                      {(t.deviation || t.missing.length > 0) && (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {t.deviation && (
                            <span className="text-xs text-caution">
                              ⚠ ルール逸脱
                            </span>
                          )}
                          <MissingBadges missing={t.missing} />
                        </span>
                      )}
                    </div>
                    <div role="cell" className="w-32 shrink-0 text-right">
                      <p className={`num text-lg ${pnlClass(t.pnlJpy)}`}>
                        {formatYenSigned(t.pnlJpy)}
                      </p>
                      <p className={`num text-xs ${pnlClass(t.pips)}`}>
                        {formatPips(t.pips)}
                      </p>
                      <p className="num text-xs text-ink-mute">
                        {formatR(t.rMultiple)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
