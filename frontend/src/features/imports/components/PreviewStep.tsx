import { ErrorAlert } from "@/components/common/ErrorAlert";
import type { DuplicateMode, PreviewResult } from "../types";
import { PreviewTable } from "./PreviewTable";

const MODES: { value: DuplicateMode; title: string; desc: string }[] = [
  {
    value: "skip",
    title: "除いて取り込む",
    desc: "取り込み済みはそのまま。根拠・メモも残ります。",
  },
  {
    value: "overwrite",
    title: "CSVの値で上書きする",
    desc: "価格・損益だけ更新します。根拠・メモ・SL・TPは残ります。",
  },
];

interface Props {
  preview: PreviewResult;
  mode: DuplicateMode;
  committing: boolean;
  commitError: boolean;
  onModeChange: (m: DuplicateMode) => void;
  onBack: () => void;
  onCommit: () => void;
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line p-3">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="num text-lg font-bold">{value}件</p>
    </div>
  );
}

/** ② 内容を確認する。件数はサーバーが全件で集計し、一覧は先頭だけ受け取る */
export function PreviewStep({
  preview,
  mode,
  committing,
  commitError,
  onModeChange,
  onBack,
  onCommit,
}: Props) {
  const { summary, files, trades, errors } = preview;
  const hasDuplicates = summary.duplicateCount > 0;
  const hasManualDuplicates = summary.manualDuplicateCount > 0;
  const nothing = summary.total === 0;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-base font-bold">ファイル</h2>
        <ul
          className="divide-y divide-line text-sm"
          aria-label="ファイルの判定"
        >
          {files.map((f) => (
            <li
              key={f.name}
              className="flex flex-wrap justify-between gap-2 py-2"
            >
              <span className="break-all">{f.name}</span>
              {f.status === "ok" ? (
                <span className="num text-ink-sub">{f.rowCount}行</span>
              ) : (
                <span className="text-loss">エラー: {f.message}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold">取り込み内容</h2>
        <div
          className={`grid grid-cols-2 gap-2 ${hasManualDuplicates ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}
        >
          <Count label="新しく取り込む" value={summary.newCount} />
          <Count label="取り込み済み" value={summary.duplicateCount} />
          {hasManualDuplicates && (
            <Count label="手入力と重複" value={summary.manualDuplicateCount} />
          )}
          <Count label="決済を反映" value={summary.completesOpenCount} />
          <Count label="未決済" value={summary.openCount} />
        </div>
        {hasManualDuplicates && (
          <p className="text-xs text-ink-mute">
            手入力したトレードと同じ取引（ペア・売買・ロットが同じで、エントリー時刻が30分以内・価格が5pips以内）は、保存しません。手入力の内容はそのまま残ります。
          </p>
        )}
        {summary.overlappedRows > 0 && (
          <p className="text-xs text-ink-mute">
            複数のファイルで重なっていた約定 {summary.overlappedRows}
            行は1件にまとめました。
          </p>
        )}
        {nothing ? (
          <p className="text-sm text-ink-sub">
            取り込めるトレードがありません。ファイルの形式を確認してください。
          </p>
        ) : (
          <>
            <PreviewTable trades={trades} />
            {summary.total > trades.length && (
              <p className="text-xs text-ink-mute">
                新しい順に先頭{trades.length}件を表示しています（全
                {summary.total}件）。
              </p>
            )}
          </>
        )}
      </section>

      {summary.errorCount > 0 && (
        <section className="card space-y-2" aria-label="取り込めない行">
          <h2 className="text-base font-bold">
            取り込めない行{" "}
            <span className="num text-loss">{summary.errorCount}件</span>
          </h2>
          <ul className="space-y-1 text-sm">
            {errors.map((e) => (
              <li key={`${e.file}:${e.line}`} className="text-ink-sub">
                {e.file} {e.line}行目
                {e.executionNo ? `（約定No.${e.executionNo}）` : ""}:{" "}
                {e.message}
              </li>
            ))}
          </ul>
          {summary.errorCount > errors.length && (
            <p className="text-xs text-ink-mute">
              先頭{errors.length}件のみ表示しています。
            </p>
          )}
          <p className="text-xs text-ink-mute">
            ほかの行は取り込めます。これらの行は取り込まれません。
          </p>
        </section>
      )}

      {hasDuplicates && (
        <fieldset className="card space-y-2">
          <legend className="text-base font-bold">取り込み済みの扱い</legend>
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex min-h-touch cursor-pointer items-start gap-3 rounded-btn border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-surface"
            >
              <input
                type="radio"
                name="duplicateMode"
                className="mt-1"
                checked={mode === m.value}
                onChange={() => onModeChange(m.value)}
              />
              <span>
                <span className="block text-sm font-bold">{m.title}</span>
                <span className="block text-xs text-ink-mute">{m.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {commitError && (
        <ErrorAlert
          message="取り込みに失敗しました。通信を確認して、もう一度試してください。"
          onRetry={onCommit}
        />
      )}

      <div className="flex justify-between gap-2">
        <button className="btn" onClick={onBack} disabled={committing}>
          ファイルを選び直す
        </button>
        <button
          className="btn-primary"
          onClick={onCommit}
          disabled={nothing || committing}
        >
          {committing ? "取り込み中…" : "取り込む"}
        </button>
      </div>
    </div>
  );
}
