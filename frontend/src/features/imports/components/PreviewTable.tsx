import {
  SIDE_LABEL,
  formatJst,
  formatPrice,
  formatYenSigned,
} from "@/utils/format";
import type { PreviewStatus, PreviewTrade } from "../types";

const STATUS_LABEL: Record<PreviewStatus, string> = {
  new: "新規",
  duplicate: "取り込み済み",
  completes_open: "決済を反映",
};

/** 取り込み候補（サーバーが返した先頭100件）。状態は色だけでなく文字でも示す */
export function PreviewTable({ trades }: { trades: PreviewTrade[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">取り込み候補</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-mute">
            <th className="py-2 pr-3">エントリー(JST)</th>
            <th className="pr-3">方向</th>
            <th className="pr-3 text-right">ロット</th>
            <th className="pr-3 text-right">エントリー</th>
            <th className="pr-3 text-right">決済</th>
            <th className="pr-3 text-right">損益</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.sourceKey} className="border-b border-line">
              <td className="num py-2 pr-3">{formatJst(t.entryAt)}</td>
              <td className="pr-3">{SIDE_LABEL[t.side]}</td>
              <td className="num pr-3 text-right">{t.lots.toFixed(2)}</td>
              <td className="num pr-3 text-right">
                {formatPrice(t.entryPrice)}
              </td>
              <td className="num pr-3 text-right">
                {t.status === "open" ? "未決済" : formatPrice(t.exitPrice)}
              </td>
              <td className="num pr-3 text-right">
                {formatYenSigned(t.pnlJpy)}
              </td>
              <td>
                <span className="rounded-chip bg-tag px-2 py-1 text-xs">
                  {STATUS_LABEL[t.importStatus]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
