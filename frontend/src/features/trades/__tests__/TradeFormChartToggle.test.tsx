import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { TradeFormPage } from "../pages/TradeFormPage";
import { apiClient } from "@/services/apiClient";
import type { Trade } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status = 400;
  },
}));

// チャート本体は重いので、受け取ったSL・TPだけ見えるダミーにする
vi.mock("../components/ChartPanel", () => ({
  ChartPanel: ({ trade }: { trade: Trade }) => (
    <div data-testid="chart-panel">
      SL:{String(trade.slPrice)} TP:{String(trade.tpPrice)}
    </div>
  ),
}));

const trade = {
  id: "t1",
  source: "rakuten_csv",
  pair: "USDJPY",
  side: "buy",
  lots: 1,
  status: "closed",
  entryAt: "2026-10-29T01:58:00Z",
  entryPrice: 157.657,
  slPrice: null,
  tpPrice: null,
  slReason: null,
  tpReason: null,
  rationaleMemo: null,
  confidence: null,
  exitAt: null,
  exitPrice: null,
  exitMethod: "open",
  insight: null,
  nextRule: null,
  tags: [],
  ruleChecks: [],
} as unknown as Trade;

function setupApi() {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === "/settings")
      return {
        balanceJpy: 750000,
        maxRiskPct: 1,
        minRr: 1.5,
        timezone: "Asia/Tokyo",
        chartDefaultTf: "5m",
        chartBarsBefore: 60,
        chartBarsAfter: 60,
        emaSettings: [],
      };
    if (path === "/currency-pairs")
      return {
        items: [
          {
            id: "p1",
            symbol: "USDJPY",
            pipSize: 0.01,
            pipValueJpyPerLot: 1000,
            showInPicker: true,
          },
        ],
      };
    if (path === "/tags") return { items: [] };
    if (path === "/rules") return { items: [] };
    if (path === "/trades/t1") return trade;
    throw new Error(`unexpected GET ${path}`);
  });
}

function renderEdit() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/trades/:id/edit", element: <TradeFormPage /> },
      { path: "/trades/:id", element: <p>詳細ページ</p> },
    ],
    { initialEntries: ["/trades/t1/edit"] },
  );
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("編集画面のチャート切り替え", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("Cキーでチャートに切り替え、入力内容を保ったままフォームに戻れる", async () => {
    const router = renderEdit();
    const sl0 = await screen.findByLabelText("損切り価格（SL）");
    await userEvent.type(sl0, "157.5");
    await userEvent.click(document.body); // 入力欄の外へ

    expect(screen.queryByTestId("chart-panel")).not.toBeInTheDocument();
    await userEvent.keyboard("c");
    // 入力中のSLがチャートに渡る
    expect(await screen.findByTestId("chart-panel")).toHaveTextContent(
      "SL:157.5",
    );
    // フォームは消えず隠れているだけ（ページ遷移もしない）
    expect(router.state.location.pathname).toBe("/trades/t1/edit");

    await userEvent.keyboard("c");
    await waitFor(() =>
      expect(screen.queryByTestId("chart-panel")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("損切り価格（SL）")).toHaveValue("157.5");
  });

  it("入力欄の中でも Alt+C で切り替えられる", async () => {
    renderEdit();
    await userEvent.click(await screen.findByLabelText("損切り価格（SL）"));
    await userEvent.keyboard("{Alt>}c{/Alt}");
    expect(await screen.findByTestId("chart-panel")).toBeInTheDocument();
  });

  it("入力欄の中で c を打っても切り替わらない", async () => {
    renderEdit();
    const sl = await screen.findByLabelText("損切り価格（SL）");
    await userEvent.type(sl, "c");
    expect(screen.queryByTestId("chart-panel")).not.toBeInTheDocument();
  });

  it("チャート表示中に入力エラーで保存すると、フォームに戻って該当欄にフォーカスする", async () => {
    renderEdit();
    await userEvent.type(
      await screen.findByLabelText("損切り価格（SL）"),
      "158",
    ); // 買いでエントリーより高い → エラー
    await userEvent.click(document.body);
    await userEvent.keyboard("c");
    await screen.findByTestId("chart-panel");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText(/買いのSL/)).toBeInTheDocument();
    expect(screen.queryByTestId("chart-panel")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("損切り価格（SL）")).toHaveFocus(),
    );
    expect(apiClient.put).not.toHaveBeenCalled();
  });
});
