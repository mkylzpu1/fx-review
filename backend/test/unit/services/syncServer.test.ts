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
  it("許可したオリジンからのPOSTで同期し、結果を返す（既定は7日）", async () => {
    const { url, run } = await start();
    const res = await post(url, { origin: ORIGIN });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(await res.json()).toEqual({ ok: true, ...summary });
    expect(run).toHaveBeenCalledWith(7);
  });

  it("days を指定できる。範囲外は400", async () => {
    const { url, run } = await start();
    await post(url, { origin: ORIGIN, body: '{"days":30}' });
    expect(run).toHaveBeenCalledWith(30);
    const bad = await post(url, { origin: ORIGIN, body: '{"days":0}' });
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
