/**
 * USDJPY の1分足を取り込んで candles_1m に保存する（手元で実行する）。
 *
 *   npm run candles:sync -- --days 7   （今日を含む直近7日）
 *   npm run candles:sync -- --from 2026-10-01 --to 2026-10-23
 *   npm run candles:sync -- --from 2026-10-01 --to 2026-10-23 --dir <MT5のCSVフォルダ>
 *   npm run candles:sync -- --from 2026-10-01 --to 2026-10-23 --provider mock
 *
 * 既定の取得元は MT5 が書き出した CSV（mt5/FxReviewExport.mq5）。
 * 普段は、アプリのトレード画面の「ローソク足を更新」ボタンから同じ処理が動く（npm run sync:server）。
 * --from / --to は UTC の日付。--to の日の終わりまで取得する。
 * 再実行しても安全（直近48時間は上書き、それより古い実データは変更しない）。
 * MT5_SERVER_TIME（または --server-time）を直したときは、--overwrite を付けて同じ期間をもう一度取り込むと、
 * 古い足の時刻も直る。
 *   npm run candles:sync -- --days 30 --overwrite
 */
import { sql } from "../src/lib/db";
import { parseSyncArgs } from "./syncArgs";
import { runSync } from "./syncRunner";

async function main() {
  await runSync(parseSyncArgs(process.argv.slice(2)), console.log);
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
