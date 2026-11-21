import { useRef, useState } from "react";
import { toast } from "@/stores/toastStore";
import {
  RAKUTEN_BRIDGE_URL,
  RakutenBridgeUnreachable,
  useRakutenImport,
} from "../hooks/useRakutenBridge";
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

function todayLocalDateInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ① 取り込み元を選び、CSVを複数まとめて選ぶ */
export function FileStep({ files, failures, busy, onSelect, onNext }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [bridgeDate, setBridgeDate] = useState(todayLocalDateInputValue);
  const rakutenImport = useRakutenImport();

  const pick = (list: FileList | null) => {
    if (list && list.length > 0) onSelect(Array.from(list));
  };

  const onAutoFetch = (kind: "execution" | "order") => {
    if (!bridgeDate) {
      toast.error("開始日を選んでください");
      return;
    }
    const date = bridgeDate.split("-").join("/");
    rakutenImport.mutate(
      { kind, date },
      {
        onSuccess: (file) => {
          onSelect([file]);
          toast.success(
            `${kind === "execution" ? "約定履歴" : "注文履歴"}を取得しました（${file.name}）`,
          );
        },
        onError: (e) =>
          toast.error(
            e instanceof RakutenBridgeUnreachable
              ? "Hammerspoonに接続できません。導入手順（hammerspoon/README.md）どおり起動しているか確認してください。"
              : `取得できませんでした。${e instanceof Error ? e.message : ""}`,
          ),
      },
    );
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

      {RAKUTEN_BRIDGE_URL && (
        <section className="card space-y-3">
          <h2 className="text-base font-bold">楽天FXから自動取得</h2>
          <p className="text-xs text-ink-mute">
            WebTraderにログインした状態で、開始日を選んで取得します（終了日は当日まで）。取得したCSVは、下のファイル選択と同じように扱われます。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input"
              aria-label="開始日"
              value={bridgeDate}
              onChange={(e) => setBridgeDate(e.target.value)}
            />
            <button
              className="btn"
              disabled={rakutenImport.isPending}
              onClick={() => onAutoFetch("execution")}
            >
              {rakutenImport.isPending ? "取得中…" : "約定履歴を取得"}
            </button>
            <button
              className="btn"
              disabled={rakutenImport.isPending}
              onClick={() => onAutoFetch("order")}
            >
              {rakutenImport.isPending ? "取得中…" : "注文履歴を取得"}
            </button>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-base font-bold">CSVファイル</h2>
        <p className="text-xs text-ink-mute">
          楽天FX証券の約定履歴CSV（トレードの登録）か、注文履歴CSV（SL・TPの反映）を選びます（Shift_JIS）。約定履歴を先に取り込んでから、注文履歴を取り込んでください。2種類は同時に選べません。
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
