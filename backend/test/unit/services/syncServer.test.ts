import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSyncServer } from "../../../scripts/syncServerCore";

const summary = {
  fetched: 10,
  chunks: 1,
  excursion: { total: 2, withData: 2 },
};
const ORIGIN = "http://localhost:5173";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function start(run = vi.fn().mockResolvedValue(summary)) {
  const server = createSyncServer(run);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  close = () => new Promise((r) => server.close(() => r()));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sync`;
  return { url, run };
}

const post = (url: string, init: RequestInit & { origin?: string } = {}) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init.origin ? { Origin: init.origin } : {}),
    },
    body: init.body ?? "{}",
  });

describe("同期用ローカルサーバー", () => {
  it("許可したオリジンからのPOSTで同期し、結果を返す（日数を省略すると全トレードの時間帯）", async () => {
    const { url, run } = await start();
    const res = await post(url, { origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(await res.json()).toEqual({ ok: true, ...summary });
    expect(run).toHaveBeenCalledWith({ days: null, tradeId: null });
  });

  it("days を指定できる。範囲外は400", async () => {
    const { url, run } = await start();
    await post(url, { origin: ORIGIN, body: '{"days":30}' });
    expect(run).toHaveBeenCalledWith({ days: 30, tradeId: null });
    const bad = await post(url, { origin: ORIGIN, body: '{"days":0}' });
    expect(bad.status).toBe(400);
  });

  it("tradeId を指定すると、そのトレードだけを依頼する。UUID以外は400", async () => {
    const { url, run } = await start();
    const id = "d8a980a5-a174-49b4-a8e4-b84cb52d42bb";
    await post(url, { origin: ORIGIN, body: JSON.stringify({ tradeId: id }) });
    expect(run).toHaveBeenCalledWith({ days: null, tradeId: id });
    const bad = await post(url, { origin: ORIGIN, body: '{"tradeId":"x"}' });
    expect(bad.status).toBe(400);
  });

  it("許可していないオリジン・オリジン無しは403で、同期しない", async () => {
    const { url, run } = await start();
    expect((await post(url, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await post(url)).status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it("JSON以外は415", async () => {
    const { url, run } = await start();
    const res = await fetch(url, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "text/plain" },
      body: "x",
    });
    expect(res.status).toBe(415);
    expect(run).not.toHaveBeenCalled();
  });

  it("実行中の2回目は409", async () => {
    let finish: (v: typeof summary) => void = () => undefined;
    const slow = vi.fn(() => new Promise<typeof summary>((r) => (finish = r)));
    const { url } = await start(slow);
    const first = post(url, { origin: ORIGIN });
    await vi.waitFor(() => expect(slow).toHaveBeenCalled());
    expect((await post(url, { origin: ORIGIN })).status).toBe(409);
    finish(summary);
    expect((await first).status).toBe(200);
  });

  it("同期が失敗したら500でメッセージを返す", async () => {
    const { url } = await start(
      vi.fn().mockRejectedValue(new Error("CSVがありません")),
    );
    const res = await post(url, { origin: ORIGIN });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, message: "CSVがありません" });
  });
});

describe("評価用HTMLの公開（/share）", () => {
  const HTML = "<!doctype html><html></html>";
  const publish = vi.fn().mockResolvedValue({
    url: "https://share.example.workers.dev/s/abc",
    expiresAt: "2026-10-27T00:00:00.000Z",
  });

  async function startShare(pub?: typeof publish) {
    const server = createSyncServer(vi.fn(), pub);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    close = () => new Promise((r) => server.close(() => r()));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/share`;
  }

  it("許可したオリジンからのPOSTで公開し、URLと期限を返す", async () => {
    publish.mockClear();
    const url = await startShare(publish);
    const res = await post(url, {
      origin: ORIGIN,
      body: JSON.stringify({ html: HTML }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      url: "https://share.example.workers.dev/s/abc",
      expiresAt: "2026-10-27T00:00:00.000Z",
    });
    expect(publish).toHaveBeenCalledWith(HTML);
  });

  it("許可していないオリジンは403。html が無ければ400", async () => {
    const url = await startShare(publish);
    const bad = await post(url, {
      origin: "http://evil.example",
      body: JSON.stringify({ html: HTML }),
    });
    expect(bad.status).toBe(403);
    const empty = await post(url, { origin: ORIGIN, body: "{}" });
    expect(empty.status).toBe(400);
  });

  it("公開の設定が無いときは、設定の場所を案内して503", async () => {
    const url = await startShare(undefined);
    const res = await post(url, {
      origin: ORIGIN,
      body: JSON.stringify({ html: HTML }),
    });
    expect(res.status).toBe(503);
    const json = (await res.json()) as { message: string };
    expect(json.message).toContain(".env.local");
  });

  it("保存に失敗したときは502で、理由の文面を返す", async () => {
    const { ShareUploadFailed } =
      await import("../../../src/services/share/kvPublisher");
    const url = await startShare(
      vi.fn().mockRejectedValue(new ShareUploadFailed("鍵が使えません")),
    );
    const res = await post(url, {
      origin: ORIGIN,
      body: JSON.stringify({ html: HTML }),
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { message: string }).message).toBe(
      "鍵が使えません",
    );
  });

  it("数百KBのHTMLも受け取れる", async () => {
    publish.mockClear();
    const url = await startShare(publish);
    const big = `<!doctype html>${"a".repeat(400_000)}`;
    const res = await post(url, {
      origin: ORIGIN,
      body: JSON.stringify({ html: big }),
    });
    expect(res.status).toBe(200);
    expect(publish.mock.calls[0][0]).toHaveLength(big.length);
  });
});
