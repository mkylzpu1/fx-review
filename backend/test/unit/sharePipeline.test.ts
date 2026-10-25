import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createSyncServer } from "../../scripts/syncServerCore";
import { publishHtml } from "../../src/services/share/kvPublisher";

type Worker = {
  fetch: (
    req: Request,
    env: { SHARES: { get: (k: string) => Promise<string | null> } },
  ) => Promise<Response>;
};

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

/** 画面 → 手元のサーバー → （偽の）Cloudflare KV → Worker → 相手の画面、の一連を通す */
describe("評価用ファイルの公開（一連の流れ）", () => {
  it("公開したHTMLを、返ってきたURLのIDでWorkerが同じ内容で返す。保存は24時間の期限つき", async () => {
    const kv = new Map<string, string>();
    const calls: string[] = [];
    const fakeCloudflare = (async (url: string, init: RequestInit) => {
      calls.push(url);
      const key = decodeURIComponent(new URL(url).pathname.split("/").pop()!);
      kv.set(key, (init.body as FormData).get("value") as string);
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;

    const cfg = {
      accountId: "a",
      namespaceId: "n",
      apiToken: "t",
      baseUrl: "https://share.example.workers.dev",
    };
    const server = createSyncServer(
      async () => ({
        fetched: 0,
        chunks: 0,
        excursion: { total: 0, withData: 0 },
      }),
      (html) => publishHtml(html, cfg, { fetchFn: fakeCloudflare }),
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    close = () => new Promise((r) => server.close(() => r()));
    const port = (server.address() as AddressInfo).port;

    const html =
      "<!doctype html><html><body><p>評価用 USDJPY</p></body></html>";
    const res = await fetch(`http://127.0.0.1:${port}/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ html }),
    });
    const body = (await res.json()) as { ok: boolean; url: string };
    expect(body.ok).toBe(true);
    expect(calls[0]).toContain("expiration_ttl=86400");

    const path = "../../../cloudflare/share-worker/src/index.js";
    const worker = (
      (await import(/* @vite-ignore */ path)) as { default: Worker }
    ).default;
    const viewed = await worker.fetch(new Request(body.url), {
      SHARES: { get: async (k) => kv.get(k) ?? null },
    });
    expect(viewed.status).toBe(200);
    expect(await viewed.text()).toBe(html);

    // 期限が来てKVから消えたら、同じURLは404になる
    kv.clear();
    const gone = await worker.fetch(new Request(body.url), {
      SHARES: { get: async (k) => kv.get(k) ?? null },
    });
    expect(gone.status).toBe(404);
  });
});
