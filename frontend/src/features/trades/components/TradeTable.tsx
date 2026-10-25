import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import {
  SIDE_LABEL,
  formatPipsValue,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { MissingItem, Trade } from "../types";
import { MiniChart, type MiniTf } from "./MiniChart";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** 列の並びは見出し・日付行・各行で共通 */
const GRID =
  "grid grid-cols-[60px_168px_148px_minmax(0,1fr)_88px_112px_76px_20px] items-center gap-x-[18px] px-6";

const TODO_LABEL: Record<Exclude<MissingItem, "open">, string> = {
  sl: "SLを入力",
  tp: "TPを入力",
  rationale: "根拠を入力",
};

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

const chip =
  "inline-flex h-6 items-center gap-1.5 rounded-chip bg-tag px-2.5 text-xs text-ink-sub";

function SideIcon({ buy }: { buy: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={buy ? "M7 17L17 7M9 7h8v8" : "M7 7l10 10M17 9v8H9"} />
    </svg>
  );
}

/** 根拠タグ・状態・未入力の入力導線を、チップで並べる */
function Chips({ t, editHref }: { t: Trade; editHref: string }) {
  const tags = t.tags ?? [];
  const todos = t.missing.filter(
    (m): m is Exclude<MissingItem, "open"> => m !== "open",
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {t.status === "open" && (
        <span className="inline-flex h-6 items-center gap-1.5 rounded-chip bg-accent/20 px-2.5 text-xs text-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-link" />
          保有中
        </span>
      )}
      {t.status === "draft" && (
        <span className="inline-flex h-6 items-center rounded-chip bg-line px-2.5 text-xs text-ink-sub">
          下書き
        </span>
      )}
      {t.deviation && (
        <span className="inline-flex h-6 items-center gap-1.5 rounded-chip bg-caution/[.13] px-2.5 text-xs text-caution">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 4l9 16H3L12 4z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          ルール逸脱
        </span>
      )}
      {tags.map((x) => (
        <span key={x.id} className={chip}>
          {x.name}
        </span>
      ))}
      {todos.map((m) => (
        <Link
          key={m}
          to={editHref}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex h-[26px] items-center gap-1.5 rounded-chip border border-dashed border-ink-mute px-[11px] text-xs font-medium text-accent-link hover:bg-accent/15"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {TODO_LABEL[m]}
        </Link>
      ))}
    </div>
  );
}

/**
 * 日付ごとにまとめた一覧。見出し・日付行・各行で列をそろえ、行全体が詳細へのリンク。
 * 買い・売りは矢印と文字で示す（色だけに頼らない）。
 */
export function TradeTable({
  trades,
  tf = "auto",
}: {
  trades: Trade[];
  tf?: MiniTf;
}) {
  const navigate = useNavigate();
  const groups = groupByDay(trades);
  return (
    <div
      role="table"
      aria-label="トレード一覧"
      className="overflow-hidden rounded-card border border-line bg-card"
    >
      <div
        role="row"
        aria-hidden="true"
        className={`${GRID} h-10 text-xs text-ink-mute`}
      >
        <span>時刻</span>
        <span>ペア・売買</span>
        <span>値動き</span>
        <span>根拠・メモ</span>
        <span className="text-right">pips</span>
        <span className="text-right">損益</span>
        <span className="text-right">R</span>
        <span />
      </div>
      {groups.map((g) => {
        const done = g.items.filter((t) => t.pnlJpy !== null);
        const total = done.reduce((a, t) => a + (t.pnlJpy ?? 0), 0);
        const holding = g.items.filter((t) => t.status === "open").length;
        const drafts = g.items.filter((t) => t.status === "draft").length;
        return (
          <div key={g.key} role="rowgroup" aria-label={g.key}>
            <div
              role="row"
              className={`${GRID} h-11 border-t border-line bg-[#12171E] text-[13px]`}
            >
              <div
                role="cell"
                className="col-span-5 flex items-baseline gap-2.5"
              >
                <strong className="text-sm">
                  {g.key}（{WEEK[g.date.getUTCDay()]}）
                </strong>
                <span className="text-xs text-ink-mute">
                  {g.items.length}件{holding > 0 ? ` ・ 保有中 ${holding}` : ""}
                  {drafts > 0 ? ` ・ 下書き ${drafts}` : ""}
                </span>
              </div>
              <span
                role="cell"
                className={`num text-right text-sm font-medium ${pnlClass(done.length > 0 ? total : null)}`}
              >
                {done.length > 0 ? formatYenSigned(total) : ""}
              </span>
            </div>
            {g.items.map((t) => {
              const href = ROUTES.TRADE_DETAIL.replace(":id", t.id);
              const editHref = ROUTES.TRADE_EDIT.replace(":id", t.id);
              const d = jst(t.entryAt);
              const buy = t.side === "buy";
              const memo = t.insight || t.rationaleMemo;
              return (
                <div
                  key={t.id}
                  role="row"
                  onClick={() => navigate(href)}
                  className={`${GRID} relative min-h-[76px] cursor-pointer border-t border-line py-3 transition-colors hover:bg-surface`}
                >
                  <span role="cell" className="num text-sm text-ink-sub">
                    {p2(d.getUTCHours())}:{p2(d.getUTCMinutes())}
                  </span>
                  <div role="cell" className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(href);
                        }}
                        className="after:absolute after:inset-0 after:content-['']"
                      >
                        <strong className="text-[15px] font-bold tracking-[.01em]">
                          {t.pair}
                        </strong>
                      </a>
                      <span
                        className={`inline-flex h-[22px] items-center gap-1 rounded-chip pl-1.5 pr-[9px] text-xs font-medium ${buy ? "bg-[#1C2A52] text-[#B7C8FF]" : "bg-[#2B2447] text-[#D6CBFF]"}`}
                      >
                        <SideIcon buy={buy} />
                        {SIDE_LABEL[t.side]}
                      </span>
                    </div>
                    <span className="num text-xs text-ink-mute">
                      {t.lots} lot
                    </span>
                  </div>
                  <div role="cell">
                    <MiniChart trade={t} tf={tf} />
                  </div>
                  <div role="cell" className="flex min-w-0 flex-col gap-[7px]">
                    <Chips t={t} editHref={editHref} />
                    {memo && (
                      <p className="truncate text-[13px] text-ink-sub">
                        {memo}
                      </p>
                    )}
                  </div>
                  <span
                    role="cell"
                    className={`num text-right text-sm ${pnlClass(t.pips)}`}
                  >
                    {formatPipsValue(t.pips)}
                  </span>
                  <span
                    role="cell"
                    className={`num text-right text-base font-medium ${pnlClass(t.pnlJpy)}`}
                  >
                    {formatYenSigned(t.pnlJpy)}
                  </span>
                  <span
                    role="cell"
                    className={`num text-right text-sm ${t.rMultiple === null ? "text-ink-mute" : "text-ink-sub"}`}
                  >
                    {formatR(t.rMultiple)}
                  </span>
                  <svg
                    className="justify-self-end"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8B95A5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
