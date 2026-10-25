import { beforeAll, describe, expect, it } from "vitest";

type Worker = {
  fetch: (
    req: Request,
    env: { SHARES: { get: (k: string) => Promise<string | null> } },
  ) => Promise<Response>;
};
let worker: Worker;
beforeAll(async () => {
  // 型を持たない素のJSなので、パスを変数にして読み込む
  const path = "../../../cloudflare/share-worker/src/index.js";
  worker = ((await import(/* @vite-ignore */ path)) as { default: Worker })
    .default;
});

const env = (store: Record<string, string>) => ({
  SHARES: { get: async (k: string) => store[k] ?? null },
});
const ID = "A".repeat(32);

describe("評価用ファイルを見せるWorker", () => {
  it("あるIDなら、HTMLを返し、検索に載せない・保存させないヘッダーを付ける", async () => {
    const res = await worker.fetch(
      new Request(`https://x.workers.dev/s/${ID}`),
      env({ [ID]: "<!doctype html><p>hi</p>" }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<p>hi</p>");
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  });

  it("期限切れ（KVに無い）・形が違うパス・ルートは404で、案内の画面を返す", async () => {
    for (const path of [`/s/${ID}`, "/s/short", "/", "/s/", `/x/${ID}`]) {
      const res = await worker.fetch(
        new Request(`https://x.workers.dev${path}`),
        env({}),
      );
      expect(res.status).toBe(404);
      expect(await res.text()).toContain("期限");
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
    }
  });

  it("GET/HEAD以外は405", async () => {
    const res = await worker.fetch(
      new Request(`https://x.workers.dev/s/${ID}`, { method: "PUT" }),
      env({ [ID]: "x" }),
    );
    expect(res.status).toBe(405);
  });
});
