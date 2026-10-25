import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { SIDE_COLORS } from "@/constants/chartTheme";
import {
  SIDE_LABEL,
  formatJst,
  formatPips,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { Trade } from "../types";
import { MissingBadges } from "./MissingBadges";

interface Props {
  trade: Trade;
  prev: { id: string } | null | undefined;
  next: { id: string } | null | undefined;
  detailPath: (id: string) => string;
  onDelete: () => void;
}

/** 詳細画面の上部: 戻る・売買と日時・結果（pipsを大きく）・前後への移動・編集 */
export function TradeDetailHeader({
  trade: t,
  prev,
  next,
  detailPath,
  onDelete,
}: Props) {
  const win = (t.pnlJpy ?? 0) > 0;
  const loss = (t.pnlJpy ?? 0) < 0;
  const tone = win ? "text-profit" : loss ? "text-loss" : "";
  const nav = (
    target: { id: string } | null | undefined,
    label: string,
    title: string,
    key: string,
  ) =>
    target ? (
      <Link
        className="btn"
        to={detailPath(target.id)}
        aria-keyshortcuts={key}
        title={title}
      >
        {label}
      </Link>
    ) : (
      <button className="btn" disabled>
        {label}
      </button>
    );

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
      <Link className="btn" to={ROUTES.TRADES}>
        一覧に戻る
      </Link>
      <div className="min-w-0">
        <p className="text-sm">
          <span
            className="font-bold"
            style={{ color: SIDE_COLORS[t.side] }}
            aria-label={SIDE_LABEL[t.side]}
          >
            {t.side === "buy" ? "▲" : "▼"} {SIDE_LABEL[t.side]}
          </span>{" "}
          <b>{t.pair}</b>
          <span className="num ml-2 text-ink-sub">{formatJst(t.entryAt)}</span>
          <span className="ml-2 text-ink-sub">{t.lots} lot</span>
          {t.status === "draft" && (
            <span className="ml-2 text-ink-sub">・ 下書き</span>
          )}
        </p>
        <MissingBadges missing={t.missing} />
      </div>
      <div className={`num ml-auto flex items-baseline gap-4 ${tone}`}>
        <span className="text-3xl font-bold leading-none">
          {formatPips(t.pips)}
        </span>
        <span>{formatR(t.rMultiple)}</span>
        <span>{formatYenSigned(t.pnlJpy)}</span>
        {t.status !== "closed" && t.pnlJpy === null && (
          <span className="text-sm text-ink-sub">（未決済）</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {nav(prev, "← 前", "前（古い）のトレード（←キー）", "ArrowLeft")}
        {nav(next, "次 →", "次（新しい）のトレード（→キー）", "ArrowRight")}
        <Link
          className="btn-primary"
          to={ROUTES.TRADE_EDIT.replace(":id", t.id)}
        >
          編集・決済入力
        </Link>
        <button className="btn-danger" onClick={onDelete}>
          削除
        </button>
      </div>
    </header>
  );
}
