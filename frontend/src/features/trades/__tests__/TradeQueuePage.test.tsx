import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TradeQueuePage } from "../pages/TradeQueuePage";
import { apiClient } from "@/services/apiClient";
import type { Trade } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const item = (id: string, missing: Trade["missing"]) =>
  ({
    id,
    pair: "USDJPY",
    side: "buy",
    entryAt: "2026-10-21T12:35:00Z",
    missing,
  }) as Trade;

const queue = (items: Trade[], total = items.length) => ({
  items,
  total,
  page: 1,
  limit: 20,
  pendingCount: 18,
  totalCount: 64,
  filledCount: 46,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TradeQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("未入力キュー", () => {
  beforeEach(() => vi.clearAllMocks());

  it("入力の進み具合と、未入力の内容を文字で表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      queue([item("a", ["sl", "tp", "rationale"]), item("b", ["open"])], 18),
    );
    renderPage();
    expect(await screen.findByText("46 / 64件")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "72",
    );
    const list = within(screen.getByRole("list"));
    expect(list.getByText("SL未入力")).toBeInTheDocument();
    expect(list.getByText("未決済")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "開く" })).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "新しい順に1件ずつ開く" }),
    ).toHaveAttribute("href", "/trades/a/edit");
  });

  it("絞り込みチップを押すと、その種類で取り直す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(queue([item("a", ["sl"])]));
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /SL・TP未入力/ }),
    );
    const paths = vi
      .mocked(apiClient.get)
      .mock.calls.map((c) => c[0] as string);
    expect(
      paths.some((p) => p.includes("filter=sl_tp") && p.includes("limit=20")),
    ).toBe(true);
  });

  it("0件なら空状態を出し、1件ずつ開くボタンは出さない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...queue([]),
      pendingCount: 0,
      filledCount: 64,
    });
    renderPage();
    expect(
      await screen.findByText("入力のないトレードはありません"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "新しい順に1件ずつ開く" }),
    ).toBeNull();
  });
});
