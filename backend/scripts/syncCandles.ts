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
import { DukascopyProvider } from "../src/services/candles/DukascopyProvider";
import { MockCandleProvider } from "../src/services/candles/MockCandleProvider";
import { syncCandles } from "../src/services/candles/syncService";
import { parseSyncArgs } from "./syncArgs";

async function main() {
  const args = parseSyncArgs(process.argv.slice(2));
  const provider =
    args.provider === "mock"
      ? new MockCandleProvider()
      : new DukascopyProvider();
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
}

main()
  .catch((e: unknown) => {
    console.error("[sync] 失敗:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
