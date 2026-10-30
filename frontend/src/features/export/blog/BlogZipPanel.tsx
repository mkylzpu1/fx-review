import { useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { usePairs } from "@/features/settings/hooks/useSettingsApi";
import { toast } from "@/stores/toastStore";
import { downloadBlob } from "../utils/download";
import type { BlogWarning } from "./bundleSchema";
import { buildDayBundles } from "./buildDayJson";
import { buildZip } from "./buildZip";
import {
  localDateTime,
  presetRange,
  todayIn,
  type RangePreset,
} from "./dateUtils";
import {
  countImages,
  generateImages,
  imageSettingsFrom,
  isAbort,
} from "./generateImages";
import { groupByDay } from "./groupByDay";
import { useCandleAvailability } from "./useCandleAvailability";
import { DEFAULT_TIMEZONE, useBlogTrades } from "./useBlogTrades";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "last7", label: "直近7日" },
  { value: "thisMonth", label: "今月" },
];

/** 画像がこの枚数を超えるときは、作る前に確認する */
export const IMAGE_CONFIRM_THRESHOLD = 90;

const WARNING_LABEL: Record<BlogWarning["code"], string> = {
  candles_missing: "ローソク足なし",
  memo_missing: "根拠メモ未入力",
  open_trade: "未決済",
  image_failed: "画像の生成に失敗",
};

/** ブログ用zip: 期間のトレードを日ごとのJSONとチャート画像にまとめて、zipでダウンロードする */
export function BlogZipPanel() {
  const today = todayIn(DEFAULT_TIMEZONE);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [includeOpen, setIncludeOpen] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<BlogWarning[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const q = useBlogTrades(from, to);
  const pairs = usePairs();

  const base = useMemo(
    () => ({ timeZone: q.timeZone, from, to, includeOpen }),
    [q.timeZone, from, to, includeOpen],
  );
  // 除外前の候補（除外チェックを外せるよう、全件を表示する）
  const candidates = useMemo(
    () => (q.rangeError ? [] : groupByDay(q.trades, base)),
    [q.trades, q.rangeError, base],
  );
  const groups = useMemo(
    () =>
      candidates
        .map((g) => ({
          date: g.date,
          trades: g.trades.filter((t) => !excluded.has(t.id)),
        }))
        .filter((g) => g.trades.length > 0),
    [candidates, excluded],
  );
  const opts = useMemo(
    () => ({ ...base, excludedIds: excluded }),
    [base, excluded],
  );
  const preview = useMemo(
    () => buildDayBundles(q.trades, opts),
    [q.trades, opts],
  );
  const total = groups.reduce((n, g) => n + g.trades.length, 0);
  const imageCount = countImages(groups);
  const availability = useCandleAvailability(
    candidates.flatMap((g) => g.trades),
  );
  const running = progress !== null;
  const timeOf = (iso: string) => localDateTime(iso, q.timeZone).slice(11);

  const toggleExcluded = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyPreset = (p: RangePreset) => {
    const r = presetRange(p, q.timeZone);
    setFrom(r.from);
    setTo(r.to);
    setResult(null);
  };

  const pipSizeOf = (pair: string) =>
    pairs.data?.find((p) => p.symbol === pair)?.pipSize ??
    (pair.includes("JPY") ? 0.01 : 0.0001);

  const run = async () => {
    const ac = new AbortController();
    abortRef.current = ac;
    setResult(null);
    setProgress({ done: 0, total: imageCount });
    try {
      const { charts, images } = await generateImages({
        groups,
        settings: imageSettingsFrom(q.settings),
        pipSizeOf,
        signal: ac.signal,
        onProgress: (done, t) => setProgress({ done, total: t }),
      });
      const r = buildZip(q.trades, { ...opts, charts, images });
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
      setResult(r.manifest.warnings);
      toast.success(`${r.fileName} をダウンロードしました`);
    } catch (e) {
      if (isAbort(e)) toast.info("キャンセルしました。zipは作っていません。");
      else toast.error("zipを作れませんでした。もう一度お試しください。");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const start = () => {
    if (imageCount > IMAGE_CONFIRM_THRESHOLD) setConfirmOpen(true);
    else void run();
  };

  return (
    <section className="card space-y-3" aria-label="ブログ用zip">
      <div>
        <h2 className="text-base font-bold">ブログ用zip</h2>
        <p className="mt-1 text-xs text-ink-mute">
          期間のトレードを、日ごとのJSONと、トレードごとのチャート画像（1分足・15分足・1時間足）にまとめます。損益額（円）は含みますが、口座残高・ID・メールは含みません。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-ink-mute">開始日</span>
          <input
            type="date"
            className="input"
            value={from}
            disabled={running}
            onChange={(e) => {
              setFrom(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink-mute">終了日</span>
          <input
            type="date"
            className="input"
            value={to}
            disabled={running}
            onChange={(e) => {
              setTo(e.target.value);
              setResult(null);
            }}
          />
        </label>
        <div role="group" aria-label="期間のプリセット" className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              className="btn"
              disabled={running}
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
          disabled={running}
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

      {!q.rangeError && !q.isLoading && !q.isError && (
        <div aria-label="プレビュー" className="space-y-2 text-sm">
          {candidates.length === 0 ? (
            <p className="text-ink-sub">
              この期間に出力できるトレードがありません。
            </p>
          ) : (
            candidates.map((g) => {
              const day = preview.days.find((d) => d.date === g.date);
              const noMemo = preview.warnings.filter(
                (w) => w.date === g.date && w.code === "memo_missing",
              ).length;
              return (
                <div key={g.date}>
                  <p className="num font-bold">
                    {g.date}: {day?.trades.length ?? 0}件
                    {noMemo > 0 && (
                      <span className="ml-2 text-xs font-normal text-ink-mute">
                        根拠メモ未入力 {noMemo}件
                      </span>
                    )}
                  </p>
                  <ul>
                    {g.trades.map((t) => {
                      const miss = availability.data?.get(t.id) ?? [];
                      return (
                        <li key={t.id}>
                          <label className="flex min-h-touch cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              aria-label={`${t.pair} ${t.side === "buy" ? "買い" : "売り"} ${timeOf(t.entryAt)} を含める`}
                              checked={!excluded.has(t.id)}
                              disabled={running}
                              onChange={() => toggleExcluded(t.id)}
                            />
                            <span className="num">
                              {timeOf(t.entryAt)} {t.pair}{" "}
                              {t.side === "buy" ? "買い" : "売り"}
                            </span>
                            {t.status === "open" && (
                              <span className="text-xs text-ink-mute">
                                未決済
                              </span>
                            )}
                            {miss.length > 0 && (
                              <span className="text-xs text-loss">
                                ローソク足なし（{miss.join("・")}）
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
          {candidates.length > 0 && (
            <p className="num text-xs text-ink-mute">
              {total}件・画像{imageCount}枚
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={
            running || q.isLoading || q.isError || !!q.rangeError || total === 0
          }
          onClick={start}
        >
          zipをダウンロード
        </button>
        {running && (
          <>
            <span role="status" className="num text-sm">
              画像を作成中 {progress.done}/{progress.total}枚
            </span>
            <button className="btn" onClick={() => abortRef.current?.abort()}>
              キャンセル
            </button>
          </>
        )}
      </div>
      {running && (
        <p className="text-xs text-ink-mute">
          画像の作成中は、このタブを開いたままにしてください。
        </p>
      )}

      {result && (
        <div aria-label="警告の一覧" className="space-y-1 text-sm">
          {result.length === 0 ? (
            <p className="text-ink-sub">警告はありません。</p>
          ) : (
            <>
              <p className="font-bold">警告 {result.length}件</p>
              <ul className="list-disc pl-5">
                {result.map((w, i) => (
                  <li key={i} className="num">
                    {w.date}
                    {w.seq !== null && ` #${w.seq}`} {WARNING_LABEL[w.code]}:{" "}
                    {w.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="画像が多くなります"
        description={`画像を${imageCount}枚作ります（${IMAGE_CONFIRM_THRESHOLD}枚を超えています）。時間がかかることがあります。続けますか？`}
        confirmLabel="作成する"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void run();
        }}
      />
    </section>
  );
}
