/** 同期用ローカルサーバーの起動: npm run sync:server（make dev から自動で起動する） */
import { parseSyncArgs } from "./syncArgs";
import { runSync, runSyncForTrades } from "./syncRunner";
import {
  loadShareConfig,
  publishHtml,
} from "../src/services/share/kvPublisher";
import { createSyncServer } from "./syncServerCore";

const PORT = Number(process.env.SYNC_SERVER_PORT) || 3100;

const shareConfig = loadShareConfig();

const server = createSyncServer(
  ({ days, tradeId }) =>
    days === null
      ? runSyncForTrades(
          parseSyncArgs(["--days", "1"]),
          console.log,
          tradeId ?? undefined,
        )
      : runSync(parseSyncArgs(["--days", String(days)]), console.log),
  shareConfig ? (html) => publishHtml(html, shareConfig) : undefined,
);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[sync-server] http://127.0.0.1:${PORT}/sync で待ち受け中`);
  console.log(
    shareConfig
      ? "[sync-server] 評価用の公開（/share）: 使えます（24時間で自動的に消えます）"
      : "[sync-server] 評価用の公開（/share）: 設定がありません（backend/.env.local に CF_* と SHARE_BASE_URL を書くと使えます）",
  );
});
