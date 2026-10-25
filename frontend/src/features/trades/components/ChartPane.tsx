import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { downloadBlob } from "@/features/export/utils/download";
import {
  TIMEFRAMES,
  type EmaSetting,
  type Timeframe,
} from "@/features/settings/types";
import { ApiError } from "@/services/apiClient";
import { toast } from "@/stores/toastStore";
import { formatJst } from "@/utils/format";
import { useCandleChunks, useCandles } from "../hooks/useCandles";
import type { Trade } from "../types";
import type { ChartRange } from "../utils/chartRange";
import { buildChartData, mergeChunks } from "../utils/chartData";
import { TF_SECONDS, chartRange, extendRange } from "../utils/chartRange";
import {
  INITIAL_BARS_AFTER,
  INITIAL_BARS_BEFORE,
  type ChartOverlays,
} from "../utils/chartOverlays";
import { excursionLevels } from "../utils/excursionLevels";
import { ChartMessage } from "./ChartMessage";
import { TradeChart, type TradeChartHandle } from "./TradeChart";

const DEFAULT_HEIGHT = 360;
const DAY_MS = 86_400_000;
// スクロールで1回に追加する足の本数と、そのEMAウォームアップ（1回のAPI上限2000本に収める）
const CHUNK_BARS = 1000;
const CHUNK_WARMUP_MAX = 500;
const NO_RANGES: ChartRange[] = [];

/** 時間足の切り替え（ラジオ）。キーボードの数字キーでも切り替える */
export function TimeframeSelect({
  value,
  onChange,
  label = "時間足",
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-btn bg-bg p-1"
    >
      {TIMEFRAMES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`num min-h-touch min-w-[3rem] rounded-btn px-3 text-sm ${
            value === t ? "bg-accent text-bg" : "text-ink-sub"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

interface Props {
  trade: Trade;
  pipSize: number;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
  emas: EmaSetting[];
  showAfter: boolean;
  overlays: ChartOverlays;
  /** 設定の「エントリー前後の日数」（スクロールで読み込める範囲の上限） */
  before: number;
  after: number;
  fullscreen: boolean;
  fixedY: boolean;
  onFixedYChange: (v: boolean) => void;
  /** 2画面のときの見出し（1画面のときは省略） */
  title?: string;
  /** 見出しの横に置く操作（2画面目の時間足の切り替えなど） */
  headerExtra?: ReactNode;
  /** チャートの高さ（px）。1画面のときは大きく取る */
  height?: number;
  /** 測定モードをキーボードから切り替えるための合図（値が変わるたびに切り替える） */
}

const canCopyImage = () =>
  typeof ClipboardItem !== "undefined" &&
  typeof navigator !== "undefined" &&
  typeof navigator.clipboard?.write === "function";

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

/** チャート1枚ぶん: 足の読み込み・追加読み込み・表示と、測定・画像保存・縦軸固定の操作 */
export function ChartPane({
  trade,
  pipSize,
  tf,
  onTfChange,
  emas,
  showAfter,
  overlays,
  before,
  after,
  fullscreen,
  fixedY,
  onFixedYChange,
  title,
  headerExtra,
  height: HEIGHT = DEFAULT_HEIGHT,
}: Props) {
  const chartRef = useRef<TradeChartHandle>(null);

  // 設定の本数が少なくても、初期表示の本数（どの時間足でも同じ）は必ず読み込む
  const loadBefore = Math.max(before, INITIAL_BARS_BEFORE);
  const loadAfter = Math.max(after, INITIAL_BARS_AFTER);

  // 非表示のEMAも含めた最長期間で取る（ON/OFFの切り替えで取り直さない）
  const periodKey = emas.map((e) => e.period).join(",");
  const range = useMemo(
    () =>
      chartRange({
        entryAt: trade.entryAt,
        exitAt: trade.exitAt,
        tf,
        barsBefore: loadBefore,
        barsAfter: loadAfter,
        emaPeriods: periodKey ? periodKey.split(",").map(Number) : [],
      }),
    [trade.entryAt, trade.exitAt, tf, loadBefore, loadAfter, periodKey],
  );
  const { data, error, isLoading, isFetching, refetch } = useCandles(tf, range);

  // スクロールで足していく範囲。上限は「1日足で見せる範囲」（エントリーの前後 before / after 日）
  const key = `${tf}|${trade.entryAt}|${trade.exitAt}|${before}|${after}`;
  const [ext, setExt] = useState<{
    key: string;
    older: ChartRange[];
    newer: ChartRange[];
  }>({ key, older: [], newer: [] });
  const older = ext.key === key ? ext.older : NO_RANGES;
  const newer = ext.key === key ? ext.newer : NO_RANGES;
  const entryMs = Date.parse(trade.entryAt);
  const endMs = trade.exitAt
    ? Math.max(Date.parse(trade.exitAt), entryMs)
    : entryMs;
  const capFrom = entryMs - before * DAY_MS;
  const capTo = endMs + after * DAY_MS;
  const loadedFrom = Date.parse((older[older.length - 1] ?? range).from);
  const loadedTo = Date.parse((newer[newer.length - 1] ?? range).to);

  // 追加した範囲のEMA助走は、いまのEMA設定から付ける（EMAを足しても、読み込み済みの範囲は捨てない）
  const chunkWarmup = Math.min(range.warmup, CHUNK_WARMUP_MAX);
  const chunkRanges = useMemo(
    () => [
      ...older.map((r) => ({ ...r, warmup: chunkWarmup })),
      ...newer.map((r) => ({ ...r, warmup: 0 })),
    ],
    [older, newer, chunkWarmup],
  );
  const chunks = useCandleChunks(tf, chunkRanges);
  const chunkBusy = chunks.some((c) => c.isFetching);

  const needMore = useCallback(
    (dir: "older" | "newer") => {
      if (chunkBusy || !data) return;
      const stepMs = TF_SECONDS[tf] * 1000 * CHUNK_BARS;
      if (dir === "older" && loadedFrom > capFrom) {
        const r = extendRange(
          Math.max(capFrom, loadedFrom - stepMs),
          loadedFrom,
          0,
        );
        setExt({ key, older: [...older, r], newer });
      } else if (dir === "newer" && loadedTo < capTo) {
        const r = extendRange(loadedTo, Math.min(capTo, loadedTo + stepMs), 0);
        setExt({ key, older, newer: [...newer, r] });
      }
    },
    [
      chunkBusy,
      data,
      tf,
      loadedFrom,
      loadedTo,
      capFrom,
      capTo,
      key,
      older,
      newer,
    ],
  );

  const chartData = useMemo(() => {
    if (!data?.hasData) return null;
    const merged = mergeChunks([
      data,
      ...chunks.flatMap((c) => (c.data ? [c.data] : [])),
    ]);
    return buildChartData({
      candles: merged.candles,
      warmupCount: merged.warmupCount,
      emaPeriods: emas.filter((e) => e.visible).map((e) => e.period),
      entrySec: Date.parse(trade.entryAt) / 1000,
      exitSec: trade.exitAt ? Date.parse(trade.exitAt) / 1000 : null,
      showAfter,
    });
  }, [data, chunks, emas, showAfter, trade.entryAt, trade.exitAt]);

  const levels = useMemo(
    () => excursionLevels(trade, pipSize),
    [trade, pipSize],
  );

  const nextTf = () =>
    onTfChange(TIMEFRAMES[(TIMEFRAMES.indexOf(tf) + 1) % TIMEFRAMES.length]);
  const retry = () => void refetch();

  const imageName = () => {
    const stamp = formatJst(trade.entryAt).replace(/\D/g, "");
    return `fx-${trade.pair}-${stamp}-${tf}.png`;
  };
  const saveImage = async () => {
    const canvas = chartRef.current?.screenshot();
    const blob = canvas ? await canvasToBlob(canvas) : null;
    if (!blob) {
      toast.error("画像を作れませんでした。もう一度試してください。");
      return;
    }
    downloadBlob(blob, imageName());
  };
  const copyImage = async () => {
    const canvas = chartRef.current?.screenshot();
    const blob = canvas ? await canvasToBlob(canvas) : null;
    if (!blob) {
      toast.error("画像を作れませんでした。もう一度試してください。");
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("チャートの画像をコピーしました");
    } catch {
      toast.error("コピーできませんでした。「画像を保存」を使ってください。");
    }
  };

  let body;
  if (isLoading) {
    body = (
      <div style={{ minHeight: HEIGHT }} className="grid place-items-center">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  } else if (error) {
    body = (
      <ChartMessage
        height={HEIGHT}
        title="足データを取得できませんでした"
        description={
          error instanceof ApiError && error.status === 400
            ? `${error.message}（表示する範囲が広すぎる場合は、大きい時間足にしてください。）`
            : "通信に失敗したか、この時間帯の1m足がありません。"
        }
        onRetry={retry}
        onOtherTf={nextTf}
      />
    );
  } else if (!chartData || chartData.candles.length === 0) {
    body = (
      <ChartMessage
        height={HEIGHT}
        title="データがありません"
        description="取引のない時間帯（週末・祝日）か、この期間の足をまだ同期していません。"
        onRetry={retry}
        onOtherTf={nextTf}
      />
    );
  } else {
    body = (
      <TradeChart
        ref={chartRef}
        data={chartData}
        side={trade.side}
        entryPrice={trade.entryPrice}
        slPrice={trade.slPrice}
        tpPrice={trade.tpPrice}
        exitPrice={trade.exitPrice}
        // 「エントリー後の値動き」を切っている間は、結果が分かる線（決済・最大含み益など）も出さない
        overlays={
          showAfter
            ? overlays
            : { ...overlays, exitLine: false, excursion: false }
        }
        excursion={levels}
        autoScaleY={!fixedY}
        onAutoScaleChange={(auto) => onFixedYChange(!auto)}
        resetKey={`${trade.id}|${tf}`}
        fill={fullscreen}
        onNeedMore={needMore}
        pipSize={pipSize}
        height={HEIGHT}
      />
    );
  }

  const hasChart =
    !isLoading && !error && chartData !== null && chartData.candles.length > 0;

  return (
    <div
      className={
        fullscreen ? "flex min-h-[280px] min-w-0 flex-1 flex-col" : "min-w-0"
      }
      aria-label={title}
    >
      {(title || headerExtra) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {title && <h3 className="text-sm font-bold">{title}</h3>}
          {headerExtra}
        </div>
      )}

      <div className={fullscreen ? "min-h-0 flex-1" : ""}>{body}</div>

      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex flex-wrap items-center gap-x-2">
          <button
            type="button"
            className="btn min-h-touch text-xs"
            disabled={!hasChart}
            onClick={() => void saveImage()}
          >
            画像を保存
          </button>
          {canCopyImage() && (
            <button
              type="button"
              className="btn min-h-touch text-xs"
              disabled={!hasChart}
              onClick={() => void copyImage()}
            >
              画像をコピー
            </button>
          )}
        </div>
        {/* 価格軸（縦軸）の真上。チェックすると、いまの縦軸の範囲で固定する */}
        <div className="flex flex-wrap items-center justify-end gap-x-2">
          {fixedY && (
            <>
              <span
                className="inline-flex items-center gap-1 rounded-chip border border-line bg-tag px-2 py-0.5 text-xs text-caution"
                role="status"
              >
                <Lock size={12} aria-hidden />
                縦軸を固定中
              </span>
              <button
                type="button"
                className="btn min-h-touch text-xs"
                onClick={() => chartRef.current?.refitY()}
              >
                範囲を合わせ直す
              </button>
            </>
          )}
          <label className="flex min-h-touch items-center gap-2 pr-1 text-sm text-ink-sub">
            <input
              type="checkbox"
              checked={fixedY}
              onChange={(e) => onFixedYChange(e.target.checked)}
            />
            縦軸固定
          </label>
        </div>
      </div>

      <div className="mt-1 flex min-h-[1.25rem] flex-wrap justify-end gap-3 text-xs text-ink-mute">
        {isFetching && !isLoading && <span>更新中…</span>}
        {data?.mock && <span className="text-caution">モックデータ</span>}
      </div>
    </div>
  );
}
