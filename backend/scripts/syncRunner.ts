/** candles:sync（コマンド）と、同期用ローカルサーバー（トレード画面のボタン）で共通の同期処理 */
import type { CandleProvider } from "../src/services/candles/CandleProvider";
import { CsvCandleProvider } from "../src/services/candles/CsvCandleProvider";
import { MockCandleProvider } from "../src/services/candles/MockCandleProvider";
import { syncCandles } from "../src/services/candles/syncService";
import { tradeWindows } from "../src/services/candles/tradeWindows";
import { excursionStore } from "../src/stores/excursionStore";
import { excursionService } from "../src/services/trade/excursionService";
import type { SyncArgs } from "./syncArgs";

export interface SyncSummary {
  fetched: number;
  chunks: number;
  /** 同期した期間にエントリーした、決済済みトレードの MFE/MAE 再計算の結果 */
  excursion: { total: number; withData: number };
}

async function createProvider(args: SyncArgs): Promise<CandleProvider> {
  if (args.provider === "mock") return new MockCandleProvider();
  if (args.provider === "mt5") {
    if (!args.dir)
      throw new Error(
        "MT5のCSVフォルダを --dir か CANDLE_CSV_DIR（backend/.env.local）で指定してください",
      );
    return new CsvCandleProvider(args.dir, args.serverTime);
  }
  // dukascopy-node は重いので、使うときだけ読み込む
  const { DukascopyProvider } =
    await import("../src/services/candles/DukascopyProvider");
  return new DukascopyProvider();
}

export async function runSync(
  args: SyncArgs,
  log: (message: string) => void = () => undefined,
): Promise<SyncSummary> {
  const provider = await createProvider(args);
  log(
    `[sync] ${args.provider}: ${args.from.toISOString()} 〜 ${args.to.toISOString()}`,
  );
  const result = await syncCandles(provider, args.from, args.to, {
    overwrite: args.overwrite,
    onProgress: (p) =>
      log(
        `[sync] ${p.from.toISOString().slice(0, 10)} 〜 ${p.to.toISOString().slice(0, 10)}: ${p.fetched}本`,
      ),
  });
  log(`[sync] 完了: ${result.fetched}本（${result.chunks}区間）`);
  const ex = await excursionService.refreshRange(args.from, args.to);
  log(
    `[sync] MFE/MAE: 決済済み${ex.total}件のうち${ex.withData}件を計算しました`,
  );
  return {
    fetched: result.fetched,
    chunks: result.chunks,
    excursion: { total: ex.total, withData: ex.withData },
  };
}

/**
 * 全トレードの時間帯（1日足で見せる範囲）の分だけ、MT5のCSVからDBへ取り込む。
 * 既にある足は上書きしないので、何度押しても重複しない（直近48時間分だけは値を更新する）。
 */
export async function runSyncForTrades(
  args: SyncArgs,
  log: (message: string) => void = () => undefined,
  tradeId?: string,
): Promise<SyncSummary & { windows: number }> {
  const windows = tradeWindows(
    await excursionStore.listTradeSpans(tradeId),
    Math.floor(Date.now() / 1000),
  );
  if (windows.length === 0) {
    log("[sync] 取り込み対象のトレードがありません");
    return {
      fetched: 0,
      chunks: 0,
      excursion: { total: 0, withData: 0 },
      windows: 0,
    };
  }
  const provider = await createProvider(args);
  let fetched = 0;
  let chunks = 0;
  for (const w of windows) {
    const from = new Date(w.from * 1000);
    const to = new Date(w.to * 1000);
    log(`[sync] トレード範囲: ${from.toISOString()} 〜 ${to.toISOString()}`);
    const r = await syncCandles(provider, from, to, {
      overwrite: args.overwrite,
    });
    fetched += r.fetched;
    chunks += r.chunks;
  }
  const ex = await excursionService.refreshRange(
    new Date(windows[0].from * 1000),
    new Date(windows[windows.length - 1].to * 1000),
  );
  log(`[sync] 完了: ${windows.length}範囲 ${fetched}本`);
  return {
    fetched,
    chunks,
    excursion: { total: ex.total, withData: ex.withData },
    windows: windows.length,
  };
}
