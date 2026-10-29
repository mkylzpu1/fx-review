import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import type { CommitResult } from "../types";

/** ③ 取り込み完了。ローソク足の同期が必要なことを案内する */
export function DoneStep({ result }: { result: CommitResult }) {
  return (
    <div className="space-y-4">
      <section className="card space-y-3" aria-live="polite">
        <h2 className="text-base font-bold">取り込みました</h2>
        <ul className="space-y-1 text-sm">
          <li>
            新しく取り込み: <span className="num">{result.imported}件</span>
          </li>
          {result.skipped > 0 && (
            <li>
              取り込み済みのため除外:{" "}
              <span className="num">{result.skipped}件</span>
            </li>
          )}
          {result.manualSkipped > 0 && (
            <li>
              手入力と同じ取引のため保存しない:{" "}
              <span className="num">{result.manualSkipped}件</span>
            </li>
          )}
          {result.overwritten > 0 && (
            <li>
              CSVの値で上書き:{" "}
              <span className="num">{result.overwritten}件</span>
            </li>
          )}
          {result.completedOpen > 0 && (
            <li>
              未決済に決済を反映:{" "}
              <span className="num">{result.completedOpen}件</span>
            </li>
          )}
          {result.errorCount > 0 && (
            <li className="text-ink-sub">
              取り込めなかった行:{" "}
              <span className="num">{result.errorCount}件</span>
            </li>
          )}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="text-base font-bold">チャートを表示するには</h2>
        <p className="text-sm text-ink-sub">
          MT5で「CSV書き出し」ボタンを押したあと、トレード一覧の「全トレードの足を更新」を押すと、
          チャートとMFE / MAEが表示されます（<code>make dev</code>{" "}
          で起動しているときに使えます）。
        </p>
      </section>

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
