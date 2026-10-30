import type {
  AccountSettings,
  EmaSetting,
  Timeframe,
} from "@/features/settings/types";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import type { CandlesResponse, Trade } from "@/features/trades/types";
import { buildChartData } from "@/features/trades/utils/chartData";
import {
  INITIAL_BARS_AFTER,
  INITIAL_BARS_BEFORE,
} from "@/features/trades/utils/chartOverlays";
import {
  TF_SECONDS,
  chartRange,
  type ChartRange,
} from "@/features/trades/utils/chartRange";
import { apiClient } from "@/services/apiClient";
import { CHART_TFS, type ChartTf } from "./bundleSchema";
import {
  chartRelPath,
  type ChartOutcome,
  type ChartOutcomes,
} from "./buildDayJson";
import type { DayImages } from "./buildZip";
import { renderChartImage, type RenderInput } from "./renderChartImage";

export interface ImageDeps {
  fetchCandles: (tf: Timeframe, range: ChartRange) => Promise<CandlesResponse>;
  render: (input: RenderInput) => Promise<Uint8Array>;
}

export const defaultImageDeps: ImageDeps = {
  fetchCandles: (tf, range) =>
    apiClient.get<CandlesResponse>(
      `/candles${toQueryString({ tf, ...range })}`,
    ),
  render: renderChartImage,
};

export interface DayGroup {
  date: string;
  trades: Trade[];
}

export interface ImageSettings {
  before: number;
  after: number;
  emas: EmaSetting[];
}

/** 設定が未作成のときの値（ChartPanel の FALLBACK と同じ） */
export function imageSettingsFrom(s: AccountSettings | null): ImageSettings {
  return {
    before: s?.chartBarsBefore ?? 40,
    after: s?.chartBarsAfter ?? 20,
    emas: s?.emaSettings ?? [{ period: 20, visible: true }],
  };
}

/** 画像の総枚数（1トレード3枚） */
export const countImages = (groups: readonly DayGroup[]) =>
  groups.reduce((n, g) => n + g.trades.length, 0) * CHART_TFS.length;

export interface GenerateInput {
  groups: readonly DayGroup[];
  settings: ImageSettings;
  /** 通貨ペア名 → 1pipの大きさ */
  pipSizeOf: (pair: string) => number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
  deps?: ImageDeps;
}

export interface GenerateResult {
  charts: ChartOutcomes;
  images: Map<string, DayImages>;
}

const abortError = () => new DOMException("キャンセルしました", "AbortError");
export const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

/** 1枚ぶん。ローソク足が無い・足りないときは candles_missing、それ以外の失敗は image_failed */
async function oneImage(
  trade: Trade,
  tf: ChartTf,
  s: ImageSettings,
  pipSize: number,
  deps: ImageDeps,
): Promise<{ outcome: ChartOutcome; png?: Uint8Array }> {
  // ChartPane と同じ読み込み本数（設定が少なくても、初期表示の本数は読む）
  const range = chartRange({
    entryAt: trade.entryAt,
    exitAt: trade.exitAt,
    tf,
    barsBefore: Math.max(s.before, INITIAL_BARS_BEFORE),
    barsAfter: Math.max(s.after, INITIAL_BARS_AFTER),
    emaPeriods: s.emas.map((e) => e.period),
  });
  let res: CandlesResponse;
  try {
    res = await deps.fetchCandles(tf, range);
  } catch (e) {
    return {
      outcome: {
        path: null,
        reason: "image_failed",
        detail: e instanceof Error ? e.message : undefined,
      },
    };
  }
  const data = buildChartData({
    candles: res.candles,
    warmupCount: res.warmupCount,
    emaPeriods: s.emas.filter((e) => e.visible).map((e) => e.period),
    entrySec: Date.parse(trade.entryAt) / 1000,
    exitSec: trade.exitAt ? Date.parse(trade.exitAt) / 1000 : null,
    showAfter: true,
    stepSec: TF_SECONDS[tf],
  });
  if (!res.hasData || data.candles.length === 0 || data.entryTime === null)
    return { outcome: { path: null, reason: "candles_missing" } };
  try {
    const png = await deps.render({ trade, data, pipSize, tf });
    return { outcome: { path: "" }, png };
  } catch (e) {
    return {
      outcome: {
        path: null,
        reason: "image_failed",
        detail: e instanceof Error ? e.message : undefined,
      },
    };
  }
}

/**
 * 全トレードの画像を、1枚ずつ順に作る（同時に描くのは1枚だけ）。
 * キャンセルされたら AbortError を投げる。1枚の失敗では止めず、結果に残す。
 */
export async function generateImages(
  i: GenerateInput,
): Promise<GenerateResult> {
  const deps = i.deps ?? defaultImageDeps;
  const total = countImages(i.groups);
  const charts = new Map<string, Partial<Record<ChartTf, ChartOutcome>>>();
  const images = new Map<string, Map<string, Uint8Array>>();
  let done = 0;
  i.onProgress?.(0, total);
  for (const g of i.groups) {
    const dayImages = new Map<string, Uint8Array>();
    images.set(g.date, dayImages);
    for (const [idx, trade] of g.trades.entries()) {
      const seq = idx + 1;
      const perTf: Partial<Record<ChartTf, ChartOutcome>> = {};
      for (const tf of CHART_TFS) {
        if (i.signal?.aborted) throw abortError();
        const r = await oneImage(
          trade,
          tf,
          i.settings,
          i.pipSizeOf(trade.pair),
          deps,
        );
        if (i.signal?.aborted) throw abortError();
        if (r.png) {
          const path = chartRelPath(seq, trade.pair, tf);
          dayImages.set(path, r.png);
          perTf[tf] = { path };
        } else {
          perTf[tf] = r.outcome;
        }
        done += 1;
        i.onProgress?.(done, total);
      }
      charts.set(trade.id, perTf);
    }
  }
  return { charts, images };
}
