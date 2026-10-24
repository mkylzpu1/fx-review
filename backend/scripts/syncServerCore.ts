/**
 * トレード画面の「ローソク足を更新」ボタンを受ける、手元専用の小さなHTTPサーバー。
 * アプリ本体（Lambda相当のコンテナ）は手元のMT5のCSVを読めないため、Macで直接動かす。
 *
 * 守りは3つ: 127.0.0.1 にだけ待ち受ける / 許可したオリジン（ローカルの画面）からだけ受ける /
 * JSON 以外は拒否する（別サイトの画面からの勝手な呼び出しを防ぐ）。同時には1回しか動かさない。
 */
import http from "node:http";
import type { SyncSummary } from "./syncRunner";

export const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const MAX_BODY_BYTES = 1024;

/** days を指定すると直近N日分、tradeId を指定するとそのトレードの時間帯分、どちらも無ければ全トレードの時間帯分 */
export type RunSync = (opts: {
  days: number | null;
  tradeId: string | null;
}) => Promise<SyncSummary>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createSyncServer(run: RunSync): http.Server {
  let running = false;

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin ?? "";
    const allowed = ALLOWED_ORIGINS.has(origin);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowed
          ? {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
              Vary: "Origin",
            }
          : {}),
      });
      res.end(JSON.stringify(body));
    };

    if (req.url !== "/sync")
      return send(404, { ok: false, message: "not found" });
    if (!allowed) return send(403, { ok: false, message: "forbidden origin" });
    if (req.method === "OPTIONS") return send(204, {});
    if (req.method !== "POST")
      return send(405, { ok: false, message: "method not allowed" });
    if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
      return send(415, { ok: false, message: "json only" });
    if (running)
      return send(409, {
        ok: false,
        message: "更新中です。終わるまで待ってください",
      });

    let days: number | null = null;
    let tradeId: string | null = null;
    try {
      const text = await readBody(req);
      if (text.trim()) {
        const parsed = JSON.parse(text) as {
          days?: unknown;
          tradeId?: unknown;
        };
        if (parsed.tradeId !== undefined) {
          if (
            typeof parsed.tradeId !== "string" ||
            !UUID_RE.test(parsed.tradeId)
          )
            return send(400, { ok: false, message: "tradeId が不正です" });
          tradeId = parsed.tradeId;
        }
        if (parsed.days !== undefined) {
          const n = Number(parsed.days);
          if (!Number.isInteger(n) || n < 1 || n > 366)
            return send(400, { ok: false, message: "days は1〜366の整数です" });
          days = n;
        }
      }
    } catch {
      return send(400, { ok: false, message: "リクエストを読めませんでした" });
    }

    running = true;
    try {
      const summary = await run({ days, tradeId });
      send(200, { ok: true, ...summary });
    } catch (e) {
      send(500, {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      running = false;
    }
  });
}
