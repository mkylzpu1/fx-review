import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError, setUnauthorizedHandler } from "../apiClient";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: undefined }),
}));

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ status, json: async () => body }),
  );
}

describe("apiClient", () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });
  beforeEach(() => vi.clearAllMocks());

  it("401（本文が独自形式でも）はログイン切れとして通知し、ApiErrorを投げる", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { message: "Unauthorized" });
    await expect(apiClient.get("/trades")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("401以外のエラーでは通知しない", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(400, {
      success: false,
      error: { code: "VALIDATION", message: "x" },
    });
    await expect(apiClient.get("/trades")).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("成功時は data を返す", async () => {
    mockFetch(200, { success: true, data: { ok: 1 } });
    await expect(apiClient.get("/x")).resolves.toEqual({ ok: 1 });
  });
});
