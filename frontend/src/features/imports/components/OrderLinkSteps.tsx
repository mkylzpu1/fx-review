import { Link } from "react-router-dom";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { ROUTES } from "@/constants/routes";
import type {
  OrderLinkCommit,
  OrderLinkPreview,
  UnfilledOrder,
} from "../types";

const SIDE = { buy: "買", sell: "売" } as const;

const jst = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 3600 * 1000)
    .toISOString()
    .slice(5, 16)
    .replace("T", " ");

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line p-3">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="num text-lg font-bold">{value}件</p>
    </div>
  );
}

function UnfilledList({ items }: { items: UnfilledOrder[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card space-y-2">
      <h2 className="text-base font-bold">約定しなかった注文</h2>
      <p className="text-sm text-ink-sub">
        取消・期限切れ・待機中の新規注文です。トレードとしては取り込まず、ここに表示するだけです。
      </p>
      <ul
        className="divide-y divide-line text-sm"
        aria-label="約定しなかった注文"
      >
        {items.map((u) => (
          <li key={u.entryOrderNo} className="num py-2">
            {jst(u.orderedAt)} {SIDE[u.side]} {u.lots}lot @{u.orderRate ?? "-"}
            <span className="ml-2 text-ink-sub">
              SL {u.slPrice ?? "-"} / TP {u.tpPrice ?? "-"}・{u.state}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface PreviewProps {
  preview: OrderLinkPreview;
  committing: boolean;
  commitError: boolean;
  onBack: () => void;
  onCommit: () => void;
}

/** ② 注文履歴の確認。約定履歴を取り込み済みのトレードに、SL・TPを結びつける */
export function OrderLinkPreviewStep({
  preview,
  committing,
  commitError,
  onBack,
  onCommit,
}: PreviewProps) {
  const { summary: s, files, unmatched, unfilled, errors } = preview;
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-base font-bold">注文履歴からSL・TPを反映</h2>
        <ul className="text-sm" aria-label="ファイルの判定">
          {files.map((f) => (
            <li key={f.name}>
              {f.name}
              {f.status === "error" && (
                <span className="ml-2 text-loss">{f.message}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Count label="約定済みの注文" value={s.filledOrders} />
          <Count label="トレードに紐づけ" value={s.matched} />
          <Count label="SL・TPを入れる" value={s.willUpdate} />
          <Count label="紐づけ先なし" value={s.unmatched} />
        </div>
        <p className="text-sm text-ink-sub">
          入力済みのSL・TPは上書きしません。決済の仕方は、初期値（手動）のトレードだけTP・SLに直します。
        </p>
        {s.slOnProfitSide > 0 && (
          <p className="text-sm text-ink-sub">
            利益側にあった逆指値{s.slOnProfitSide}件は、SLに入れません。
          </p>
        )}
        {s.rejected > 0 && (
          <p className="text-sm text-ink-sub">
            リジェクト（約定前に拒否）{s.rejected}件は対象外です。
          </p>
        )}
        {s.unmatched > 0 && (
          <p className="text-sm text-ink-sub">
            紐づけ先が無い注文が{s.unmatched}
            件あります。先に約定履歴CSVを取り込んでください。
          </p>
        )}
      </section>

      {unmatched.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-base font-bold">紐づけ先が無い注文</h2>
          <ul
            className="divide-y divide-line text-sm"
            aria-label="紐づけ先が無い注文"
          >
            {unmatched.map((p) => (
              <li key={p.entryOrderNo} className="num py-2">
                {jst(p.orderedAt)} {SIDE[p.side]} {p.lots}lot @{p.entryRate}
              </li>
            ))}
          </ul>
        </section>
      )}
      <UnfilledList items={unfilled} />

      {errors.length > 0 && (
        <p className="text-sm text-ink-sub">
          読み取れなかった行が{errors.length}件あります。
        </p>
      )}
      {commitError && (
        <ErrorAlert message="反映できませんでした。通信を確認して、もう一度試してください。" />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onBack}>
          戻る
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={committing || s.willUpdate === 0}
          onClick={onCommit}
        >
          {committing ? "反映中…" : `${s.willUpdate}件に反映する`}
        </button>
      </div>
    </div>
  );
}

/** ③ 反映完了 */
export function OrderLinkDoneStep({ result }: { result: OrderLinkCommit }) {
  return (
    <div className="space-y-4">
      <section className="card space-y-2" aria-live="polite">
        <h2 className="text-base font-bold">SL・TPを反映しました</h2>
        <p className="text-sm">
          <span className="num">{result.updated}件</span>
          のトレードを更新しました。
        </p>
      </section>
      <UnfilledList items={result.unfilled} />
      <div className="flex justify-end gap-2">
        <Link className="btn" to={ROUTES.TRADES}>
          トレード一覧へ
        </Link>
        <Link className="btn-primary" to={ROUTES.TRADE_QUEUE}>
          入力を続ける
        </Link>
      </div>
    </div>
  );
}
