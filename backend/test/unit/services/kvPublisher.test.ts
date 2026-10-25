import { describe, expect, it, vi } from "vitest";
import {
  SHARE_TTL_SECONDS,
  ShareUploadFailed,
  loadShareConfig,
  newShareId,
  publishHtml,
} from "../../../src/services/share/kvPublisher";

const cfg = {
  accountId: "acc1",
  namespaceId: "ns1",
  apiToken: "tok-secret",
  baseUrl: "https://share.example.workers.dev",
};
const HTML = "<!doctype html><html><body>x</body></html>";
const ok = () =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));

describe("loadShareConfig", () => {
  const env = {
    CF_ACCOUNT_ID: "a",
    CF_KV_NAMESPACE_ID: "n",
    CF_API_TOKEN: "t",
    SHARE_BASE_URL: "https://x.workers.dev/",
  };
  it("4つそろっていれば読み、URL末尾のスラッシュは取る", () => {
    expect(loadShareConfig(env)).toEqual({
      accountId: "a",
      namespaceId: "n",
      apiToken: "t",
      baseUrl: "https://x.workers.dev",
    });
  });
  it("1つでも欠けていれば null（公開は使えない）", () => {
    expect(loadShareConfig({ ...env, CF_API_TOKEN: "  " })).toBeNull();
    expect(loadShareConfig({})).toBeNull();
  });
});

describe("publishHtml", () => {
  it("24時間で消える設定でKVに書き、見せるURLと期限を返す", async () => {
    const fetchFn = ok();
    const now = new Date("2026-10-26T00:00:00Z");
    const r = await publishHtml(HTML, cfg, {
      fetchFn,
      now: () => now,
      newId: () => "abc123",
    });
    expect(r.url).toBe("https://share.example.workers.dev/s/abc123");
    expect(r.expiresAt).toBe("2026-10-27T00:00:00.000Z");

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acc1/storage/kv/namespaces/ns1/values/abc123?expiration_ttl=${SHARE_TTL_SECONDS}`,
    );
    expect(SHARE_TTL_SECONDS).toBe(86400);
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-secret",
    );
    expect((init.body as FormData).get("value")).toBe(HTML);
  });

  it("HTML以外・大きすぎるものは送らない", async () => {
    const fetchFn = ok();
    await expect(publishHtml("hello", cfg, { fetchFn })).rejects.toThrow(
      ShareUploadFailed,
    );
    await expect(
      publishHtml(`<!doctype html>${"a".repeat(9 * 1024 * 1024)}`, cfg, {
        fetchFn,
      }),
    ).rejects.toThrow("大きすぎ");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("鍵が使えない（401/403）・その他の失敗・接続失敗を、分かる文面で返す。トークンは文面に出さない", async () => {
    const run = (res: Response | Error) =>
      publishHtml(HTML, cfg, {
        fetchFn: vi.fn().mockImplementation(async () => {
          if (res instanceof Error) throw res;
          return res;
        }),
      }).catch((e: Error) => e.message);
    expect(await run(new Response("{}", { status: 403 }))).toContain("鍵");
    const m500 = await run(
      new Response(JSON.stringify({ errors: [{ message: "boom" }] }), {
        status: 500,
      }),
    );
    expect(m500).toContain("500");
    expect(m500).toContain("boom");
    expect(await run(new Error("net"))).toContain("接続できません");
    for (const m of [m500, await run(new Response("{}", { status: 401 }))])
      expect(m).not.toContain("tok-secret");
  });
});

describe("newShareId", () => {
  it("URLに使える文字だけの、十分に長いランダムなID", () => {
    const a = newShareId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newShareId()).not.toBe(a);
  });
});
