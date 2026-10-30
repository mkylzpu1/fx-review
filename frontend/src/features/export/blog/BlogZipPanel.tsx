import { useMemo, useState } from "react";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { toast } from "@/stores/toastStore";
import { downloadBlob } from "../utils/download";
import { buildDayBundles } from "./buildDayJson";
import { buildZip } from "./buildZip";
import { presetRange, todayIn, type RangePreset } from "./dateUtils";
import { DEFAULT_TIMEZONE, useBlogTrades } from "./useBlogTrades";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "last7", label: "直近7日" },
  { value: "thisMonth", label: "今月" },
];

/** ブログ用zip: 期間のトレードを日ごとのJSONにまとめて、zipでダウンロードする */
export function BlogZipPanel() {
  const today = todayIn(DEFAULT_TIMEZONE);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [includeOpen, setIncludeOpen] = useState(false);
  const q = useBlogTrades(from, to);

  const opts = useMemo(
    () => ({ timeZone: q.timeZone, from, to, includeOpen }),
    [q.timeZone, from, to, includeOpen],
  );
  const preview = useMemo(
    () => (q.rangeError ? null : buildDayBundles(q.trades, opts)),
    [q.trades, q.rangeError, opts],
  );
  const total = preview?.days.reduce((n, d) => n + d.trades.length, 0) ?? 0;

  const applyPreset = (p: RangePreset) => {
    const r = presetRange(p, q.timeZone);
    setFrom(r.from);
    setTo(r.to);
  };

  const download = () => {
    const r = buildZip(q.trades, opts);
    if (r.empty) {
      toast.error("この期間に出力できるトレードがありません。");
      return;
    }
    downloadBlob(
      new Blob([r.bytes as Uint8Array<ArrayBuffer>], {
        type: "application/zip",
      }),
      r.fileName,
    );
    toast.success(`${r.fileName} をダウンロードしました`);
  };

  return (
    <section className="card space-y-3" aria-label="ブログ用zip">
      <div>
        <h2 className="text-base font-bold">ブログ用zip</h2>
        <p className="mt-1 text-xs text-ink-mute">
          期間のトレードを日ごとのJSONにまとめます。損益額（円）は含みますが、口座残高・ID・メールは含みません。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-ink-mute">開始日</span>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-mute">終了日</span>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div role="group" aria-label="期間のプリセット" className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              className="btn"
              onClick={() => applyPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={includeOpen}
          onChange={() => setIncludeOpen((v) => !v)}
        />
        未決済を含める
      </label>

      {q.rangeError && (
        <p role="alert" className="text-sm text-loss">
          {q.rangeError}
        </p>
      )}
      {q.isLoading && <LoadingSpinner fullScreen={false} />}
      {q.isError && <ErrorAlert onRetry={q.refetch} />}

      {preview && !q.isLoading && (
        <div aria-label="プレビュー" className="space-y-1 text-sm">
          {total === 0 ? (
            <p className="text-ink-sub">
              この期間に出力できるトレードがありません。
            </p>
          ) : (
            <ul>
              {preview.days.map((d) => {
                const noMemo = preview.warnings.filter(
                  (w) => w.date === d.date && w.code === "memo_missing",
                ).length;
                return (
                  <li key={d.date} className="num">
                    {d.date}: {d.trades.length}件
                    {noMemo > 0 && `（根拠メモ未入力 ${noMemo}件）`}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <button
        className="btn-primary"
        disabled={q.isLoading || q.isError || !!q.rangeError || total === 0}
        onClick={download}
      >
        zipをダウンロード
      </button>
    </section>
  );
}
