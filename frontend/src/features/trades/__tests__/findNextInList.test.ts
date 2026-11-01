import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { findNextInList } from "../hooks/useTradesApi";
import { apiClient } from "@/services/apiClient";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const pageOf = (ids: string[], total = ids.length) => ({
  items: items(...ids),
  total,
  page: 1,
  limit: 100,
});
const client = () => new QueryClient();

describe("findNextInList（保存して次のトレードへ）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("一覧の並びで、いま開いているトレードの次を返す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(pageOf(["a", "b", "c"]));
    expect(await findNextInList(client(), "b", ["USDJPY"])).toEqual({
      kind: "next",
      id: "c",
    });
  });

  it("/trades で保存している絞り込み・並び順をそのまま使う", async () => {
    localStorage.setItem("fx-review:trade-list-result", "loss");
    localStorage.setItem("fx-review:trade-list-deviation", "1");
    localStorage.setItem("fx-review:trade-list-pair", "USDJPY");
    localStorage.setItem("fx-review:trade-list-sort", "pnl_asc");
    localStorage.setItem("fx-review:trade-list-period", "all");
    vi.mocked(apiClient.get).mockResolvedValue(pageOf(["a", "b"]));
    await findNextInList(client(), "a", ["USDJPY"]);
    const url = String(vi.mocked(apiClient.get).mock.calls[0][0]);
    expect(url).toContain("result=loss");
    expect(url).toContain("deviationOnly=true");
    expect(url).toContain("pair=USDJPY");
    expect(url).toContain("sort=pnl_asc");
    expect(url).not.toContain("from=");
  });

  it("設定から消えたペアは「すべて」として扱う", async () => {
    localStorage.setItem("fx-review:trade-list-pair", "EURUSD");
    vi.mocked(apiClient.get).mockResolvedValue(pageOf(["a", "b"]));
    await findNextInList(client(), "a", ["USDJPY"]);
    expect(String(vi.mocked(apiClient.get).mock.calls[0][0])).not.toContain(
      "pair=",
    );
  });

  it("次のページにまたがるときも、次のトレードを返す", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(pageOf(["a", "b"], 3))
      .mockResolvedValueOnce(pageOf(["c"], 3));
    expect(await findNextInList(client(), "b", [])).toEqual({
      kind: "next",
      id: "c",
    });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("一覧の最後なら last を返す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(pageOf(["a", "b"]));
    expect(await findNextInList(client(), "b", [])).toEqual({ kind: "last" });
  });

  it("一覧に今のトレードが無いときは、先頭のトレードから始める", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(pageOf(["a", "b"]));
    expect(await findNextInList(client(), "zzz", [])).toEqual({
      kind: "next",
      id: "a",
    });
  });
});
