import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/candles/candleService", () => ({
  candleService: { get: vi.fn() },
}));

import {
  MAX_BATCH_REQUESTS,
  batchHandler,
  getHandler,
} from "../../../../src/handlers/candles";
import { candleService } from "../../../../src/services/candles/candleService";
import { ValidationError } from "../../../../src/lib/errors";

const ev = (q: Record<string, string> | null) =>
  ({ queryStringParameters: q }) as unknown as APIGatewayProxyEvent;

const ok = {
  tf: "1h",
  from: "2026-10-21T00:00:00+09:00",
  to: "2026-10-21T12:00:00+09:00",
};

describe("GET /candles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("正常系: 日時を秒に直してサービスへ渡す（warmup 省略は0）", async () => {
    vi.mocked(candleService.get).mockResolvedValue({
      tf: "1h",
      candles: [],
      warmupCount: 0,
      hasData: false,
      mock: false,
    });
    const res = await getHandler(ev(ok));
    expect(res.statusCode).toBe(200);
    expect(candleService.get).toHaveBeenCalledWith({
      tf: "1h",
      fromSec: Date.parse("2026-10-20T15:00:00Z") / 1000,
      toSec: Date.parse("2026-10-21T03:00:00Z") / 1000,
      warmup: 0,
    });
    expect(JSON.parse(res.body).success).toBe(true);
  });

  it("warmup を数値で渡す", async () => {
    vi.mocked(candleService.get).mockResolvedValue({} as never);
    await getHandler(ev({ ...ok, warmup: "600" }));
    expect(vi.mocked(candleService.get).mock.calls[0][0].warmup).toBe(600);
  });

  it.each([
    ["tfが不正", { ...ok, tf: "2h" }],
    ["fromなし", { tf: "1h", to: ok.to }],
    ["日時がISOでない", { ...ok, from: "2026/10/21" }],
    ["warmupが整数でない", { ...ok, warmup: "-1" }],
  ])("400: %s", async (_name, q) => {
    const res = await getHandler(ev(q));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
    expect(candleService.get).not.toHaveBeenCalled();
  });

  it("クエリ自体が無いときも 400", async () => {
    expect((await getHandler(ev(null))).statusCode).toBe(400);
  });

  it("サービスの ValidationError は 400 で返す", async () => {
    vi.mocked(candleService.get).mockRejectedValue(
      new ValidationError("範囲が広すぎます"),
    );
    const res = await getHandler(ev(ok));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.message).toContain("範囲が広すぎます");
  });

  it("想定外のエラーは 500", async () => {
    vi.mocked(candleService.get).mockRejectedValue(new Error("db down"));
    expect((await getHandler(ev(ok))).statusCode).toBe(500);
  });
});

const evPost = (body: unknown) =>
  ({
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as APIGatewayProxyEvent;

describe("POST /candles/batch", () => {
  beforeEach(() => vi.clearAllMocks());

  const empty = {
    tf: "1h" as const,
    candles: [],
    warmupCount: 0,
    hasData: false,
    mock: false,
  };

  it("正常系: 範囲ごとに結果を、渡した順で返す", async () => {
    vi.mocked(candleService.get).mockResolvedValue(empty);
    const res = await batchHandler(
      evPost({ requests: [ok, { ...ok, tf: "5m", warmup: 10 }] }),
    );
    expect(res.statusCode).toBe(200);
    expect(candleService.get).toHaveBeenCalledTimes(2);
    expect(vi.mocked(candleService.get).mock.calls[1][0]).toMatchObject({
      tf: "5m",
      warmup: 10,
    });
    const { results } = JSON.parse(res.body).data;
    expect(results).toEqual([
      { ok: true, data: empty },
      { ok: true, data: empty },
    ]);
  });

  it("1つの範囲が広すぎても、ほかの範囲は返す", async () => {
    vi.mocked(candleService.get)
      .mockRejectedValueOnce(new ValidationError("範囲が広すぎます"))
      .mockResolvedValueOnce(empty);
    const res = await batchHandler(evPost({ requests: [ok, ok] }));
    expect(res.statusCode).toBe(200);
    const { results } = JSON.parse(res.body).data;
    expect(results[0]).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "範囲が広すぎます",
    });
    expect(results[1].ok).toBe(true);
  });

  it("想定外のエラーは 500", async () => {
    vi.mocked(candleService.get).mockRejectedValue(new Error("db down"));
    expect((await batchHandler(evPost({ requests: [ok] }))).statusCode).toBe(
      500,
    );
  });

  it.each([
    ["ボディなし", null],
    ["JSONでない", "{"],
    ["requestsが空", { requests: [] }],
    ["tfが不正", { requests: [{ ...ok, tf: "2h" }] }],
    ["日時がISOでない", { requests: [{ ...ok, from: "2026/10/21" }] }],
    [
      "件数が多すぎる",
      { requests: Array.from({ length: MAX_BATCH_REQUESTS + 1 }, () => ok) },
    ],
  ])("400: %s", async (_name, body) => {
    const res = await batchHandler(
      body === null
        ? ({ body: null } as unknown as APIGatewayProxyEvent)
        : evPost(body),
    );
    expect(res.statusCode).toBe(400);
    expect(candleService.get).not.toHaveBeenCalled();
  });
});
