import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import {
  RAKUTEN_BRIDGE_URL,
  RakutenBridgeUnreachable,
  useRakutenImport,
} from "../hooks/useRakutenBridge";
import { useImportCommit, useImportPreview } from "../hooks/useImportApi";
import { isOrderCommit } from "../types";
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

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocalDateInputValue(): string {
  return toDateInputValue(new Date());
}

/** 月曜始まりの週の開始日 */
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=日, 1=月, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 開始日のクイック選択。終了日は常に当日まで（ブリッジの仕様） */
const DATE_PRESETS: { id: string; label: string; startDate: () => Date }[] = [
  { id: "today", label: "今日", startDate: () => new Date() },
  { id: "thisWeek", label: "今週", startDate: () => startOfWeek(new Date()) },
  {
    id: "lastWeek",
    label: "先週",
    startDate: () => {
      const d = startOfWeek(new Date());
      d.setDate(d.getDate() - 7);
      return d;
    },
  },
  { id: "thisMonth", label: "今月", startDate: () => startOfMonth(new Date()) },
];

type AutoStage = "execution" | "order" | null;
type Method = "auto" | "manual";

/** ① 取り込み元を選び、CSVを複数まとめて選ぶ */
export function FileStep({ files, failures, busy, onSelect, onNext }: Props) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [bridgeDate, setBridgeDate] = useState(todayLocalDateInputValue);
  const [datePreset, setDatePreset] = useState<string | null>("today");
  const rakutenImport = useRakutenImport();
  const previewApi = useImportPreview();
  const commitApi = useImportCommit();
  const [autoStage, setAutoStage] = useState<AutoStage>(null);
  const [method, setMethod] = useState<Method>(
    RAKUTEN_BRIDGE_URL ? "auto" : "manual",
  );

  const pick = (list: FileList | null) => {
    if (list && list.length > 0) onSelect(Array.from(list));
  };

  const bridgeErrorMessage = (e: unknown) =>
    e instanceof RakutenBridgeUnreachable
      ? "Hammerspoonに接続できません。導入手順（hammerspoon/README.md）どおり起動しているか確認してください。"
      : `取得できませんでした。${e instanceof Error ? e.message : ""}`;

  /** 1種類（約定履歴 or 注文履歴）をダウンロードして、プレビュー・取り込みまで行う */
  const fetchAndCommit = async (kind: "execution" | "order", date: string) => {
    const file = await rakutenImport.mutateAsync({ kind, date });
    const preview = await previewApi.mutateAsync([file]);
    const hasErrorFile = preview.files.some((f) => f.status === "error");
    if (hasErrorFile) {
      const message = preview.files.find((f) => f.status === "error")?.message;
      throw new Error(message ?? "CSVの形式を確認できませんでした");
    }
    return commitApi.mutateAsync({ files: [file], duplicateMode: "overwrite" });
  };

  /** ボタン1つで、約定履歴→注文履歴の順に自動ダウンロード・取り込みする */
  const onAutoImportAll = async () => {
    if (!bridgeDate) {
      toast.error("開始日を選んでください");
      return;
    }
    const date = bridgeDate.split("-").join("/");

    setAutoStage("execution");
    try {
      const result = await fetchAndCommit("execution", date);
      if (!isOrderCommit(result)) {
        toast.success(
          `約定履歴: ${result.imported}件を取り込みました${result.overwritten > 0 ? `（既存${result.overwritten}件を上書き）` : ""}`,
        );
      }
    } catch (e) {
      setAutoStage(null);
      toast.error(`約定履歴の取り込みに失敗しました。${bridgeErrorMessage(e)}`);
      return;
    }

    setAutoStage("order");
    try {
      const result = await fetchAndCommit("order", date);
      if (isOrderCommit(result)) {
        toast.success(`注文履歴: ${result.updated}件にSL・TPを反映しました`);
      }
      // 約定履歴・注文履歴とも取り込みが終わったので、アプリ側の画面に戻す
      navigate(ROUTES.TRADE_QUEUE);
    } catch (e) {
      toast.error(`注文履歴の取り込みに失敗しました。${bridgeErrorMessage(e)}`);
    } finally {
      setAutoStage(null);
    }
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
        <div role="tablist" aria-label="取り込み方法" className="flex gap-2">
          <button
            role="tab"
            aria-selected={method === "auto"}
            className={`btn ${method === "auto" ? "border-accent bg-surface" : ""}`}
            onClick={() => setMethod("auto")}
          >
            楽天FXから自動取得
          </button>
          <button
            role="tab"
            aria-selected={method === "manual"}
            className={`btn ${method === "manual" ? "border-accent bg-surface" : ""}`}
            onClick={() => setMethod("manual")}
          >
            CSVファイルを選ぶ
          </button>
        </div>
      )}

      {RAKUTEN_BRIDGE_URL && method === "auto" && (
        <section className="card space-y-3" role="tabpanel">
          <h2 className="text-base font-bold">楽天FXから自動取得</h2>
          <p className="text-xs text-ink-mute">
            WebTraderにログインした状態で、開始日を選んでボタンを押すと、約定履歴→注文履歴の順にダウンロードして、このままfx-reviewに取り込みます（終了日は当日まで）。完了すると、未入力キューに自動で戻ります。
          </p>
          <div
            role="radiogroup"
            aria-label="開始日のクイック選択"
            className="flex flex-wrap gap-2"
          >
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={datePreset === p.id}
                disabled={autoStage !== null}
                className={`btn ${datePreset === p.id ? "border-accent bg-surface" : ""}`}
                onClick={() => {
                  setDatePreset(p.id);
                  setBridgeDate(toDateInputValue(p.startDate()));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input"
              aria-label="開始日"
              value={bridgeDate}
              disabled={autoStage !== null}
              onChange={(e) => {
                setBridgeDate(e.target.value);
                setDatePreset(null);
              }}
            />
            <button
              className="btn-primary"
              disabled={autoStage !== null}
              onClick={() => void onAutoImportAll()}
            >
              {autoStage === "execution"
                ? "約定履歴を取得・取り込み中…"
                : autoStage === "order"
                  ? "注文履歴を取得・取り込み中…"
                  : "約定履歴・注文履歴を自動取得して取り込む"}
            </button>
          </div>
        </section>
      )}

      {(!RAKUTEN_BRIDGE_URL || method === "manual") && (
        <section className="card space-y-3" role="tabpanel">
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

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={files.length === 0 || busy}
              onClick={onNext}
            >
              {busy ? "読み込み中…" : "内容を確認する"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
