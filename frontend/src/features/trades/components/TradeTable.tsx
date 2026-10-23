import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import {
  SIDE_LABEL,
  formatJst,
  formatPips,
  formatR,
  formatYenSigned,
} from "@/utils/format";
import type { Trade } from "../types";
import { MissingBadges } from "./MissingBadges";

/** 損益は符号と記号で示し、色は補助にとどめる */
const pnlClass = (v: number | null) =>
  v === null
    ? "text-ink-mute"
    : v > 0
      ? "text-profit"
      : v < 0
        ? "text-loss"
        : "";

export function TradeTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-sub">
          <tr>
            <th className="py-2 pr-3 font-medium">エントリー</th>
            <th className="py-2 pr-3 font-medium">ペア・売買</th>
            <th className="py-2 pr-3 text-right font-medium">ロット</th>
            <th className="py-2 pr-3 text-right font-medium">pips</th>
            <th className="py-2 pr-3 text-right font-medium">損益</th>
            <th className="py-2 pr-3 text-right font-medium">R</th>
            <th className="py-2 pr-3 font-medium">ルール</th>
            <th className="py-2 font-medium">未入力</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="num py-3 pr-3">
                <Link
                  className="text-accent-link underline"
                  to={ROUTES.TRADE_DETAIL.replace(":id", t.id)}
                >
                  {formatJst(t.entryAt)}
                </Link>
                {t.status === "draft" && (
                  <span className="ml-2 text-xs text-ink-mute">下書き</span>
                )}
              </td>
              <td className="py-3 pr-3">
                {t.pair} {SIDE_LABEL[t.side]}
              </td>
              <td className="num py-3 pr-3 text-right">{t.lots}</td>
              <td className={`num py-3 pr-3 text-right ${pnlClass(t.pips)}`}>
                {formatPips(t.pips)}
              </td>
              <td className={`num py-3 pr-3 text-right ${pnlClass(t.pnlJpy)}`}>
                {formatYenSigned(t.pnlJpy)}
              </td>
              <td className="num py-3 pr-3 text-right">
                {formatR(t.rMultiple)}
              </td>
              <td className="py-3 pr-3">
                {t.deviation ? (
                  <span className="text-caution">⚠ ルール逸脱</span>
                ) : (
                  <span className="text-ink-mute">—</span>
                )}
              </td>
              <td className="py-3">
                <MissingBadges missing={t.missing} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
