/** 同期用ローカルサーバーの起動: npm run sync:server（make dev から自動で起動する） */
import { parseSyncArgs } from "./syncArgs";
import { runSync } from "./syncRunner";
import { createSyncServer } from "./syncServerCore";

const PORT = Number(process.env.SYNC_SERVER_PORT) || 3100;

const server = createSyncServer((days) =>
  runSync(parseSyncArgs(["--days", String(days)]), console.log),
);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[sync-server] http://127.0.0.1:${PORT}/sync で待ち受け中`);
});
