import { useRef, useState } from "react";
import type { ReadFailure } from "../utils/readCsvFile";

const SYSTEMS: { id: string; label: string; ready: boolean }[] = [
  { id: "rakuten", label: "楽天FX証券", ready: true },
  { id: "mt5", label: "MT5", ready: false },
  { id: "other", label: "その他", ready: false },
];

interface Props {
  files: File[];
  failures: ReadFailure[];
  busy: boolean;
  onSelect: (files: File[]) => void;
  onNext: () => void;
}

/** ① 取り込み元を選び、CSVを複数まとめて選ぶ */
export function FileStep({ files, failures, busy, onSelect, onNext }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list: FileList | null) => {
    if (list && list.length > 0) onSelect(Array.from(list));
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="text-base font-bold">取り込み元</h2>
        <div
          role="radiogroup"
          aria-label="取り込み元"
          className="flex flex-wrap gap-2"
        >
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={s.ready}
              disabled={!s.ready}
              title={s.ready ? undefined : "準備中"}
              className={`btn ${s.ready ? "border-accent bg-surface" : ""}`}
            >
              {s.label}
              {!s.ready && (
                <span className="ml-2 text-xs text-ink-mute">準備中</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold">約定履歴のCSV</h2>
        <p className="text-xs text-ink-mute">
          楽天FX証券の約定履歴CSV（Shift_JIS）を、複数ファイルまとめて選べます。
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-card border border-dashed p-4 ${
            dragging ? "border-accent bg-surface" : "border-field"
          }`}
        >
          <p className="text-sm text-ink-sub">ここにCSVをドロップ</p>
          <button className="btn" onClick={() => input.current?.click()}>
            ファイルを選ぶ
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            aria-label="CSVファイル"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul
            className="divide-y divide-line text-sm"
            aria-label="選んだファイル"
          >
            {files.map((f) => (
              <li key={f.name} className="flex justify-between gap-3 py-2">
                <span className="break-all">{f.name}</span>
                <span className="num text-ink-mute">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </li>
            ))}
          </ul>
        )}

        {failures.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-loss">
            {failures.map((f) => (
              <li key={f.name}>
                {f.name}: {f.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={files.length === 0 || busy}
          onClick={onNext}
        >
          {busy ? "読み込み中…" : "内容を確認する"}
        </button>
      </div>
    </div>
  );
}
