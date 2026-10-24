import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { TradeDetailPage } from "../pages/TradeDetailPage";
import { apiClient, ApiError } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";
import type { Trade } from "../types";

vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return {
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    ApiError,
  };
});

vi.mock("../components/TradeChart", () => ({
  TradeChart: () => <div data-testid="trade-chart" />,
}));

const trade = {
  id: "t1",
  source: "manual",
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  status: "closed",
  entryAt: "2026-10-01T13:10:00Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.4,
  slReason: null,
  tpReason: null,
  rationaleMemo: "押し目を待った",
  confidence: 4,
  exitAt: "2026-10-01T13:40:00Z",
  exitPrice: 150.3,
  exitMethod: "manual",
  pnlJpy: 3000,
  insight: null,
  nextRule: null,
  tags: [{ id: "g", name: "押し目", kind: "rationale" }],
  ruleChecks: [],
  pips: 30,
  rMultiple: 1.5,
  plannedRr: 2,
  riskJpy: 2000,
  riskPct: 0.27,
  holdMinutes: 30,
  ruleResults: [
    { ruleId: "r1", title: "TPまで持つ", result: "ng", isActive: true },
  ],
  deviation: true,
  isUnfilled: false,
  missing: [],
} as unknown as Trade;

function setup(getTrade: () => Promise<unknown>) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === "/trades/t1") return getTrade();
    if (path === "/currency-pairs")
      return {
        items: [
          {
            id: "p",
            symbol: "USDJPY",
            pipSize: 0.01,
            pipValueJpyPerLot: 1000,
            showInPicker: true,
          },
        ],
      };
    if (path === "/settings")
      return {
        balanceJpy: 1000000,
        maxRiskPct: 1,
        minRr: 2,
        timezone: "Asia/Tokyo",
        chartDefaultTf: "1h",
        chartBarsBefore: 40,
        chartBarsAfter: 20,
        emaSettings: [{ period: 20, visible: true }],
      };
    if (path.startsWith("/candles?"))
      return {
        tf: "1h",
        candles: [
          {
            time: 1759320000,
            open: 150,
            high: 150.2,
            low: 149.9,
            close: 150.1,
          },
        ],
        warmupCount: 0,
        hasData: true,
        mock: false,
      };
    if (path.startsWith("/trades?"))
      return { items: [trade], total: 1, page: 1, limit: 6 };
    throw new Error(path);
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/trades/:id", element: <TradeDetailPage /> },
      { path: "/trades", element: <p>一覧ページ</p> },
    ],
    { initialEntries: ["/trades/t1"] },
  );
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("トレード詳細", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ items: [] });
  });

  it("結果・計画・ルール判定を表示する（NGは文字でも示す）", async () => {
    setup(async () => trade);
    expect(await screen.findByText("+¥3,000")).toBeInTheDocument();
    expect(screen.getByText("1 : 2.00")).toBeInTheDocument();
    expect(screen.getByText("✗ NG")).toBeInTheDocument();
    expect(
      screen.getByText("⚠ 守れていないルールがあります"),
    ).toBeInTheDocument();
    expect(screen.getByText("押し目を待った")).toBeInTheDocument();
    expect(await screen.findByTestId("trade-chart")).toBeInTheDocument();
  });

  it("存在しないトレードは見つからない案内を出す", async () => {
    setup(async () => {
      throw new ApiError("NOT_FOUND", "トレードが見つかりません", 404);
    });
    expect(
      await screen.findByText("このトレードは見つかりません"),
    ).toBeInTheDocument();
  });

  it("削除は確認してから行い、一覧に戻って「取り消す」を出す", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ id: "t1" });
    const router = setup(async () => trade);
    await userEvent.click(await screen.findByRole("button", { name: "削除" }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith("/trades/t1"),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/trades"));
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.action?.label).toBe("取り消す");
    vi.mocked(apiClient.post).mockResolvedValue(trade);
    toast?.action?.onClick();
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/trades/t1/restore", {}),
    );
  });
});
