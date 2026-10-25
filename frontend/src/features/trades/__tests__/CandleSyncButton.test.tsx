import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CandleSyncButton } from "../components/CandleSyncButton";
import { useToastStore } from "@/stores/toastStore";

vi.mock("@/features/settings/hooks/useCandleSync", async (orig) => ({
  ...(await orig<typeof import("@/features/settings/hooks/useCandleSync")>()),
  CANDLE_SYNC_URL: "http://localhost:3100",
}));

const toasts = () => useToastStore.getState().items.map((t) => t.message);

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CandleSyncButton />
    </QueryClientProvider>,
  );
}

describe("ローソク足の更新ボタン（トレード画面）", () => {
  beforeEach(() => useToastStore.setState({ items: [] }));
  afterEach(() => vi.unstubAllGlobals());

  it("MT5で書き出してから押す注意書きを出す", () => {
    renderIt();
    expect(screen.getByText(/CSV書き出し/)).toBeInTheDocument();
  });

  it("日数を指定せず、全トレードの時間帯の取り込みを依頼して結果を知らせる", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        fetched: 120,
        windows: 2,
        excursion: { total: 2, withData: 2 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "全トレードの足を更新" }),
    );
    await waitFor(() =>
      expect(toasts().some((m) => m.includes("120本"))).toBe(true),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3100/sync");
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("トレードIDを渡すと、そのトレードだけを依頼する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        fetched: 5,
        excursion: { total: 1, withData: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CandleSyncButton tradeId="t-1" />
      </QueryClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "このトレードの足を更新" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      tradeId: "t-1",
    });
  });

  it("同期サーバーに届かないときは、起動の確認を促す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "全トレードの足を更新" }),
    );
    await waitFor(() =>
      expect(toasts().some((m) => m.includes("make dev"))).toBe(true),
    );
  });

  it("一覧の上部用は、手順を見せなくてもMT5での書き出しを押す案内がボタンに付く", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CandleSyncButton variant="header" />
      </QueryClientProvider>,
    );
    const btn = screen.getByRole("button", { name: "全トレードの足を更新" });
    expect(btn).toHaveTextContent("足を更新");
    expect(btn).toHaveAttribute(
      "title",
      expect.stringContaining("CSV書き出し"),
    );
  });
});
