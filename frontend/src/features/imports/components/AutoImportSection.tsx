import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/stores/toastStore";
import {
  RakutenBridgeUnreachable,
  useRakutenImport,
} from "../hooks/useRakutenBridge";
import { useImportCommit, useImportPreview } from "../hooks/useImportApi";
import { isOrderCommit } from "../types";

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

/**
 * 「楽天FXから自動取得」タブ本体。
 * ①選ぶ→②確認→③取り込む の3ステップを踏まず、ボタン1つで
 * ダウンロード・プレビュー・取り込みまで一気に行うため、手動CSV取り込み
 * （FileStep〜PreviewStep〜DoneStepの3ステップ）とはあえて画面ごと分けている。
 */
export function AutoImportSection() {
  const navigate = useNavigate();
  const [bridgeDate, setBridgeDate] = useState(todayLocalDateInputValue);
  const [datePreset, setDatePreset] = useState<string | null>("today");
  const rakutenImport = useRakutenImport();
  const previewApi = useImportPreview();
  const commitApi = useImportCommit();
  const [autoStage, setAutoStage] = useState<AutoStage>(null);

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
    <section className="card space-y-3" role="tabpanel">
      <h2 className="text-base font-bold">楽天FXから自動取得</h2>
      <p className="text-xs text-ink-mute">
        WebTraderにログインした状態で、開始日を選んでボタンを押すと、約定履歴→注文履歴の順にダウンロードして、このままfx-reviewに取り込みます（終了日は当日まで）。確認画面を挟まず、そのまま取り込まれます。完了すると、未入力キューに自動で戻ります。
      </p>
      <p className="rounded-card border border-field bg-surface p-3 text-xs text-ink-sub">
        ※ 事前に
        <a
          href="https://github.com/mkylzpu1/fx-review/tree/main/hammerspoon"
          target="_blank"
          rel="noreferrer"
          className="mx-1 font-bold text-accent-link underline"
        >
          Hammerspoon
        </a>
        の導入・設定が必要です（詳しくは
        <code>hammerspoon/README.md</code>
        を参照）。未設定の場合は、「CSVファイルを選ぶ」タブから手動で取り込んでください。
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
  );
}
