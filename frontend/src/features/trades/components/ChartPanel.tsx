import { useCallback, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  TIMEFRAMES,
  type AccountSettings,
  type EmaSetting,
  type Timeframe,
} from "@/features/settings/types";
import { ApiError } from "@/services/apiClient";
import { useCandleChunks, useCandles } from "../hooks/useCandles";
import type { Trade } from "../types";
import type { ChartRange } from "../utils/chartRange";
import { buildChartData, mergeChunks } from "../utils/chartData";
import { TF_SECONDS, chartRange, extendRange } from "../utils/chartRange";
import { CandleSyncButton } from "./CandleSyncButton";
import { ChartMessage } from "./ChartMessage";
import { EmaControls } from "./EmaControls";
import { TradeChart } from "./TradeChart";

const HEIGHT = 360;
const DAY_MS = 86_400_000;
// スクロールで1回に追加する足の本数と、そのEMAウォームアップ（1回のAPI上限2000本に収める）
const CHUNK_BARS = 1000;
const CHUNK_WARMUP_MAX = 500;
const NO_RANGES: ChartRange[] = [];
// 設定が未作成（オンボーディング前）のときの表示
const FALLBACK = {
  tf: "1h" as Timeframe,
  before: 40,
  after: 20,
  emas: [{ period: 20, visible: true }] as EmaSetting[],
};

interface Props {
  trade: Trade;
  pipSize: number;
  settings: AccountSettings | null;
}

/** トレード詳細のチャート領域: 時間足・EMA・エントリー後の値動きの切り替えと、各状態の表示 */
export function ChartPanel({ trade, pipSize, settings }: Props) {
  const [tf, setTf] = useState<Timeframe>(
    settings?.chartDefaultTf ?? FALLBACK.tf,
  );
  const [emas, setEmas] = useState<EmaSetting[]>(
    settings?.emaSettings ?? FALLBACK.emas,
  );
  const [showAfter, setShowAfter] = useState(true);
  const before = settings?.chartBarsBefore ?? FALLBACK.before;
  const after = settings?.chartBarsAfter ?? FALLBACK.after;

  // 非表示のEMAも含めた最長期間で取る（ON/OFFの切り替えで取り直さない）
  const periodKey = emas.map((e) => e.period).join(",");
  const range = useMemo(
    () =>
      chartRange({
        entryAt: trade.entryAt,
        exitAt: trade.exitAt,
        tf,
        barsBefore: before,
        barsAfter: after,
        emaPeriods: periodKey ? periodKey.split(",").map(Number) : [],
      }),
    [trade.entryAt, trade.exitAt, tf, before, after, periodKey],
  );
  const { data, error, isLoading, isFetching, refetch } = useCandles(tf, range);

  // スクロールで足していく範囲。上限は「1日足で見せる範囲」（エントリーの前後 before / after 日）
  const key = `${tf}|${trade.entryAt}|${trade.exitAt}|${before}|${after}|${periodKey}`;
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

  const chunkRanges = useMemo(() => [...older, ...newer], [older, newer]);
  const chunks = useCandleChunks(tf, chunkRanges);
  const chunkBusy = chunks.some((c) => c.isFetching);

  const needMore = useCallback(
    (dir: "older" | "newer") => {
      if (chunkBusy || !data) return;
      const stepMs = TF_SECONDS[tf] * 1000 * CHUNK_BARS;
      const warmup = Math.min(range.warmup, CHUNK_WARMUP_MAX);
      if (dir === "older" && loadedFrom > capFrom) {
        const r = extendRange(
          Math.max(capFrom, loadedFrom - stepMs),
          loadedFrom,
          warmup,
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
      range.warmup,
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

  const nextTf = () =>
    setTf(TIMEFRAMES[(TIMEFRAMES.indexOf(tf) + 1) % TIMEFRAMES.length]);
  const retry = () => void refetch();

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
        data={chartData}
        side={trade.side}
        entryPrice={trade.entryPrice}
        slPrice={trade.slPrice}
        tpPrice={trade.tpPrice}
        exitPrice={trade.exitPrice}
        resetKey={`${trade.id}|${tf}|${showAfter}`}
        onNeedMore={needMore}
        pipSize={pipSize}
        height={HEIGHT}
      />
    );
  }

  return (
    <section className="card space-y-3" aria-label="チャート">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label="時間足"
          className="inline-flex rounded-btn bg-bg p-1"
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tf === t}
              onClick={() => setTf(t)}
              className={`num min-h-touch min-w-[3rem] rounded-btn px-3 text-sm ${
                tf === t ? "bg-accent text-white" : "text-ink-sub"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex min-h-touch items-center gap-2 text-sm text-ink-sub">
          <input
            type="checkbox"
            checked={showAfter}
            onChange={(e) => setShowAfter(e.target.checked)}
          />
          エントリー後の値動き
        </label>
      </div>
      <EmaControls emas={emas} onChange={setEmas} />
      {body}
      <CandleSyncButton tradeId={trade.id} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-mute">
        <span>
          チャートの価格はMT5の配信値のため、楽天FXの約定価格とわずかにずれることがあります。
        </span>
        <span className="flex gap-3">
          {isFetching && !isLoading && <span>更新中…</span>}
          {data?.mock && <span className="text-caution">モックデータ</span>}
        </span>
      </div>
    </section>
  );
}
