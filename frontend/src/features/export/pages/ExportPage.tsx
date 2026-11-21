import { useState } from "react";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { PeriodKey } from "@/features/stats/types";
import { PERIODS } from "@/features/stats/utils/period";
import { toast } from "@/stores/toastStore";
import { type CustomDateRange, useExport } from "../hooks/useExport";
import { BlogZipPanel } from "../blog/BlogZipPanel";
import type { ExportFormat, Include, IncludeKey } from "../types";
import { downloadText } from "../utils/download";
import { DEFAULT_INCLUDE, FORMATS, INCLUDES, PREVIEW_CHARS } from "../utils/options";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 「期間を指定」の初期値：今日を終了日、7日前を開始日にする */
function defaultCustomRange(): CustomDateRange {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

/** AIに貼り付けて分析してもらう出力。サーバーが組み立てた文字列を、コピー・ダウンロードするだけ */
export function ExportPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customRange, setCustomRange] = useState<CustomDateRange>(
    defaultCustomRange,
  );
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [include, setInclude] = useState<Include>(DEFAULT_INCLUDE);
  const { data, isLoading, isError, isFetching, refetch } = useExport(
    period,
    format,
    include,
    customRange,
  );

  const [showBlog, setShowBlog] = useState(false);
  const toggle = (k: IncludeKey) => setInclude((p) => ({ ...p, [k]: !p[k] }));

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.content);
      toast.success("コピーしました。AIの入力欄に貼り付けてください");
    } catch {
      toast.error(
        "コピーできませんでした。「ダウンロード」を使うか、ブラウザの権限を確認してください。",
      );
    }
  };

  const preview = data
    ? data.content.length > PREVIEW_CHARS
      ? `${data.content.slice(0, PREVIEW_CHARS)}\n…（以降はコピー・ダウンロードに含まれます）`
      : data.content
    : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">エクスポート</h1>
        <p className="mt-1 text-sm text-ink-sub">
          記録をまとめて出力します。AIに貼り付けて「どう改善すべきか」を分析してもらえます。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          <section className="card space-y-2">
            <h2 className="text-base font-bold">対象期間</h2>
            <div
              role="group"
              aria-label="対象期間"
              className="flex flex-wrap gap-2"
            >
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  aria-pressed={period === p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`btn ${period === p.value ? "border-accent bg-accent/10 text-accent-link" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="input"
                  aria-label="開始日"
                  value={customRange.from}
                  max={customRange.to}
                  onChange={(e) =>
                    setCustomRange((r) => ({ ...r, from: e.target.value }))
                  }
                />
                <span className="text-sm text-ink-mute">〜</span>
                <input
                  type="date"
                  className="input"
                  aria-label="終了日"
                  value={customRange.to}
                  min={customRange.from}
                  onChange={(e) =>
                    setCustomRange((r) => ({ ...r, to: e.target.value }))
                  }
                />
              </div>
            )}
          </section>

          <fieldset className="card space-y-2">
            <legend className="text-base font-bold">含める項目</legend>
            {INCLUDES.map((i) => (
              <label
                key={i.key}
                className="flex min-h-touch cursor-pointer items-start gap-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={include[i.key]}
                  onChange={() => toggle(i.key)}
                />
                <span>
                  <span className="block text-sm font-bold">{i.label}</span>
                  <span className="block text-xs text-ink-mute">{i.desc}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-ink-mute">
              エントリー前後のローソク足・EMA値は、まだ出力できません。
            </p>
          </fieldset>

          <fieldset className="card space-y-2">
            <legend className="text-base font-bold">形式</legend>
            {FORMATS.map((f) => (
              <label
                key={f.value}
                className="flex min-h-touch cursor-pointer items-start gap-3"
              >
                <input
                  type="radio"
                  name="format"
                  className="mt-1"
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                />
                <span>
                  <span className="block text-sm font-bold">{f.label}</span>
                  <span className="block text-xs text-ink-mute">{f.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              プレビュー
              {data && (
                <span className="num ml-2 text-xs font-normal text-ink-mute">
                  {data.tradeCount}件
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                className="btn-primary"
                disabled={!data || isFetching}
                onClick={() => void copy()}
              >
                全データをコピー
              </button>
              <button
                className="btn"
                disabled={!data || isFetching}
                onClick={() =>
                  data && downloadText(data.content, data.filename, data.mime)
                }
              >
                ダウンロード
              </button>
            </div>
          </div>
          {isLoading && <LoadingSpinner fullScreen={false} />}
          {isError && <ErrorAlert onRetry={() => void refetch()} />}
          {data && data.tradeCount === 0 && (
            <p className="text-sm text-ink-sub">
              この期間のトレードがありません。期間を広げると出力できます。
            </p>
          )}
          {data && (
            <pre
              aria-label="出力プレビュー"
              className="num max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-btn bg-bg p-3 text-xs"
            >
              {preview}
            </pre>
          )}
        </section>
      </div>

      <div className="space-y-2">
        <button
          className="btn"
          aria-expanded={showBlog}
          onClick={() => setShowBlog((v) => !v)}
        >
          ブログ用zip {showBlog ? "▲" : "▼"}
        </button>
        {showBlog && <BlogZipPanel />}
      </div>
    </div>
  );
}
