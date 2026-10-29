import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { buildSyncCommand } from "../utils/syncCommand";
import type { CommitResult } from "../types";

/** ③ 取り込み完了。ローソク足の同期が必要なことを案内する */
export function DoneStep({ result }: { result: CommitResult }) {
  const command = buildSyncCommand(result.entryRange);
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

      {command && (
        <section className="card space-y-2">
          <h2 className="text-base font-bold">チャートを表示するには</h2>
          <p className="text-sm text-ink-sub">
            ローソク足は手元で同期します。次のコマンドを backend
            で実行すると、チャートとMFE / MAEが表示されます（日付はUTC）。
          </p>
          <pre className="num overflow-x-auto rounded-btn bg-bg p-3 text-sm">
            {command}
          </pre>
        </section>
      )}

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
