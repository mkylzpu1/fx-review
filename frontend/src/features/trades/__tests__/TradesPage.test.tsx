import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TradesPage } from "../pages/TradesPage";
import { apiClient } from "@/services/apiClient";
import type { Trade } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const trade = (o: Partial<Trade> = {}): Trade =>
  ({
    id: "t1",
    pair: "USDJPY",
    side: "buy",
    lots: 0.1,
    status: "closed",
    entryAt: "2026-10-01T13:10:00Z",
    pips: 30,
    pnlJpy: 3000,
    rMultiple: 1.5,
    deviation: false,
    missing: [],
    tags: [],
    ...o,
  }) as Trade;

const page = (items: Trade[], total = items.length) => ({
  items,
  total,
  page: 1,
  limit: 20,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("トレード一覧", () => {
  beforeEach(() => vi.clearAllMocks());

  it("0件ならはじめの案内を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([]));
    renderPage();
    expect(
      await screen.findByText("まだトレードがありません"),
    ).toBeInTheDocument();
  });

  it("損益は符号つきで、逸脱と未入力を文字で示す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page([
        trade({ id: "a" }),
        trade({
          id: "b",
          pips: -12.5,
          pnlJpy: -1250,
          rMultiple: null,
          deviation: true,
          missing: ["sl", "rationale"],
        }),
      ]),
    );
    renderPage();
    const table = within(await screen.findByRole("table"));
    expect(table.getByText("+30.0")).toBeInTheDocument();
    expect(table.getByText("−12.5")).toBeInTheDocument();
    expect(screen.getByText("ルール逸脱")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SLを入力" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "根拠を入力" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2件のうち、2件を表示/)).toBeInTheDocument();
  });

  it("絞り込みはサーバーに渡し、該当なしなら条件を変える案内を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(page([trade()]));
    renderPage();
    await screen.findByRole("table");
    vi.mocked(apiClient.get).mockResolvedValue(page([]));
    await userEvent.click(screen.getByRole("button", { name: "負け" }));
    await userEvent.click(
      screen.getByRole("button", { name: "ルール逸脱のみ" }),
    );
    await waitFor(() => {
      const last = vi.mocked(apiClient.get).mock.calls.at(-1)?.[0] as string;
      expect(last).toContain("result=loss");
      expect(last).toContain("deviationOnly=true");
    });
    expect(
      await screen.findByText("条件に合うトレードがありません"),
    ).toBeInTheDocument();
  });

  it("チャートの時間足を切り替えると、一覧の全チャートがその足で取得される", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      page([
        trade({ id: "a", entryPrice: 150, exitAt: "2026-10-01T14:10:00Z" }),
        trade({ id: "b", entryPrice: 151, exitAt: "2026-10-01T15:10:00Z" }),
      ]),
    );
    localStorage.clear();
    renderPage();
    await screen.findByRole("table");
    const group = screen.getByRole("group", { name: "チャートの時間足" });
    expect(within(group).getByRole("button", { name: "自動" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(group).getByRole("button", { name: "15分" }));
    await waitFor(() => {
      const urls = vi
        .mocked(apiClient.get)
        .mock.calls.map((c) => c[0] as string)
        .filter((u) => u.startsWith("/candles") && u.includes("tf=15m"));
      expect(urls.length).toBeGreaterThanOrEqual(2);
    });
    expect(within(group).getByRole("button", { name: "15分" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
