/**
 * USDJPY の1分足を取得して candles_1m に保存する（手元で実行する）。
 *
 *   npm run candles:sync -- --from 2026-10-01 --to 2026-10-23
 *   npm run candles:sync -- --from 2026-10-01 --to 2026-10-23 --provider mock
 *
 * --from / --to は UTC の日付。--to の日の終わりまで取得する。
 * 再実行しても安全（直近48時間は上書き、それより古い実データは変更しない）。
 */
import { sql } from "../src/lib/db";
import { MockCandleProvider } from "../src/services/candles/MockCandleProvider";
import { syncCandles } from "../src/services/candles/syncService";
import { excursionService } from "../src/services/trade/excursionService";
import { parseSyncArgs } from "./syncArgs";

async function main() {
  const args = parseSyncArgs(process.argv.slice(2));
  // dukascopy-node は重いので、使うときだけ読み込む
  const provider =
    args.provider === "mock"
      ? new MockCandleProvider()
      : new (
          await import("../src/services/candles/DukascopyProvider")
        ).DukascopyProvider();
  console.log(
    `[sync] ${args.provider}: ${args.from.toISOString()} 〜 ${args.to.toISOString()}`,
  );
  const result = await syncCandles(provider, args.from, args.to, {
    onProgress: (p) =>
      console.log(
        `[sync] ${p.from.toISOString().slice(0, 10)} 〜 ${p.to.toISOString().slice(0, 10)}: ${p.fetched}本`,
      ),
  });
  console.log(`[sync] 完了: ${result.fetched}本（${result.chunks}区間）`);
  // 同期した期間にエントリーしたトレードの MFE / MAE を計算し直す
  const ex = await excursionService.refreshRange(args.from, args.to);
  console.log(
    `[sync] MFE/MAE: 決済済み${ex.total}件のうち${ex.withData}件を計算しました`,
  );
}

main()
  .catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sync] 失敗:", message);
    if (message.includes("TLS") || message.includes("ECONNREFUSED")) {
      console.error(
        "[sync] ヒント: DB に接続できていない可能性があります。docker compose up -d でPostgreSQLを起動し、backend/.env.local に DATABASE_URL と IS_LOCAL=true があるか確認してください",
      );
    }
    process.exitCode = 1;
  })
  .finally(() => sql.end());
