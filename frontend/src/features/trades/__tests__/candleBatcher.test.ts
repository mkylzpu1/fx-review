import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "@/services/apiClient";
import { MAX_BATCH, fetchCandlesBatched } from "../hooks/candleBatcher";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

const range = (n: number) => ({
  from: `2026-10-01T0${n % 10}:00:00Z`,
  to: `2026-10-01T1${n % 10}:00:00Z`,
  warmup: 0,
});
const res = (tf: string) => ({
  tf,
  candles: [],
  warmupCount: 0,
  hasData: false,
  mock: false,
});

describe("fetchCandlesBatched", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("短い間に出た要求は、1回のリクエストにまとめ、結果を要求ごとに返す", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      results: [
        { ok: true, data: res("5m") },
        { ok: true, data: res("1h") },
      ],
    });
    const a = fetchCandlesBatched("5m", range(1));
    const b = fetchCandlesBatched("1h", range(2));
    await vi.advanceTimersByTimeAsync(100);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as {
      requests: { tf: string }[];
    };
    expect(body.requests.map((r) => r.tf)).toEqual(["5m", "1h"]);
    expect((await a).tf).toBe("5m");
    expect((await b).tf).toBe("1h");
  });

  it("1つの範囲が失敗しても、ほかの範囲は返す", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      results: [
        { ok: false, code: "VALIDATION_ERROR", message: "範囲が広すぎます" },
        { ok: true, data: res("1h") },
      ],
    });
    const a = fetchCandlesBatched("5m", range(1));
    const b = fetchCandlesBatched("1h", range(2));
    const aErr = a.catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(((await aErr) as Error).message).toBe("範囲が広すぎます");
    expect((await b).tf).toBe("1h");
  });

  it("通信に失敗したら、まとめた要求すべてが失敗する", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("network"));
    const a = fetchCandlesBatched("5m", range(1)).catch(
      (e: Error) => e.message,
    );
    const b = fetchCandlesBatched("1h", range(2)).catch(
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(await a).toBe("network");
    expect(await b).toBe("network");
  });

  it("上限を超えたら、待たずに送り、残りは次のリクエストにする", async () => {
    vi.mocked(apiClient.post).mockImplementation(async (_u, body) => ({
      results: (body as { requests: { tf: string }[] }).requests.map((r) => ({
        ok: true,
        data: res(r.tf),
      })),
    }));
    const all = Array.from({ length: MAX_BATCH + 2 }, (_, i) =>
      fetchCandlesBatched("5m", range(i)),
    );
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all(all);
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    const sizes = vi
      .mocked(apiClient.post)
      .mock.calls.map((c) => (c[1] as { requests: unknown[] }).requests.length);
    expect(sizes).toEqual([MAX_BATCH, 2]);
  });
});
