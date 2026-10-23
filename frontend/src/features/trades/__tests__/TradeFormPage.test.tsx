import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { TradeFormPage } from "../pages/TradeFormPage";
import { apiClient } from "@/services/apiClient";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status = 400;
  },
}));

const settings = {
  balanceJpy: 750000,
  maxRiskPct: 1,
  minRr: 1.5,
  timezone: "Asia/Tokyo",
  chartDefaultTf: "5m",
  chartBarsBefore: 60,
  chartBarsAfter: 60,
  emaSettings: [],
};
const pairs = [
  {
    id: "p1",
    symbol: "USDJPY",
    pipSize: 0.01,
    pipValueJpyPerLot: 1000,
    showInPicker: true,
  },
];
const tags = [
  { id: "g1", kind: "rationale", name: "押し目", sortOrder: 0 },
  { id: "g2", kind: "emotion", name: "冷静", sortOrder: 0 },
];

function setupApi() {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path === "/settings") return settings;
    if (path === "/currency-pairs") return { items: pairs };
    if (path === "/tags") return { items: tags };
    if (path === "/rules") return { items: [] };
    throw new Error(`unexpected GET ${path}`);
  });
  vi.mocked(apiClient.post).mockResolvedValue({ id: "t-new" });
}

function renderNew() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/trades/new", element: <TradeFormPage /> },
      { path: "/trades/:id", element: <p>詳細ページ</p> },
      { path: "/trades", element: <p>一覧ページ</p> },
    ],
    { initialEntries: ["/trades/new"] },
  );
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("トレード記録フォーム", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("必須が空のまま保存すると、各項目の直下にエラーを出し、送信しない", async () => {
    renderNew();
    await userEvent.click(await screen.findByRole("button", { name: "保存" }));
    expect(
      await screen.findByText("ロットを入力してください"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("エントリー価格を入力してください"),
    ).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText("ロット")).toHaveFocus();
  });

  it("SL・TP・根拠なしでも、必須だけで保存できる", async () => {
    const router = renderNew();
    await userEvent.type(await screen.findByLabelText("ロット"), "0.1");
    await userEvent.type(screen.getByLabelText("エントリー価格"), "150.123");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(apiClient.post).mock.calls[0];
    expect(path).toBe("/trades");
    expect(body).toMatchObject({
      pair: "USDJPY",
      side: "buy",
      lots: 0.1,
      entryPrice: 150.123,
      slPrice: null,
      tpPrice: null,
      exitAt: null,
      draft: false,
      tagIds: [],
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/trades/t-new"),
    );
  });

  it("買いでSLがエントリーより高いと項目直下にエラー", async () => {
    renderNew();
    await userEvent.type(await screen.findByLabelText("ロット"), "0.1");
    await userEvent.type(screen.getByLabelText("エントリー価格"), "150");
    await userEvent.type(screen.getByLabelText("損切り価格（SL）"), "151");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText(/買いのSL/)).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("SL・TPを入れると想定リスクとRRを表示し、RRが低いと注意（保存は可能）", async () => {
    renderNew();
    await userEvent.type(await screen.findByLabelText("ロット"), "0.1");
    await userEvent.type(screen.getByLabelText("エントリー価格"), "150");
    await userEvent.type(screen.getByLabelText("損切り価格（SL）"), "149.8");
    await userEvent.type(screen.getByLabelText("利確価格（TP）"), "150.2");
    expect(screen.getByText("1 : 1.00")).toBeInTheDocument();
    expect(
      screen.getByText(/RRが設定の最低値（1.5）より低く/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it("入力があるまま離れようとすると確認を出し、下書き保存で保存して移動できる", async () => {
    const router = renderNew();
    await userEvent.type(await screen.findByLabelText("ロット"), "0.1");
    await userEvent.type(screen.getByLabelText("エントリー価格"), "150");
    void router.navigate("/trades/x");
    expect(
      await screen.findByText("未保存の変更があります"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "下書き保存" }));
    await waitFor(() =>
      expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({
        draft: true,
      }),
    );
  });
});
