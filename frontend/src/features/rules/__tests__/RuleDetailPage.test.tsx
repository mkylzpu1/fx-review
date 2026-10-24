import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RuleDetailPage } from "../pages/RuleDetailPage";
import { apiClient } from "@/services/apiClient";
import type { RuleDetail } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const detail = (over: Partial<RuleDetail> = {}): RuleDetail => ({
  rule: {
    id: "r1",
    title: "SLを必ず入れる",
    description: "エントリー前にSLを置く",
    isActive: true,
    sortOrder: 0,
    autoKey: "sl_set",
    validationTargetN: 10,
    validationStartedAt: null,
  },
  kept: 6,
  broke: 2,
  recent: { weeks: 4, kept: 3, broke: 1, rate: 75 },
  avgKept: { n: 5, avgR: 0.8 },
  avgBroken: { n: 2, avgR: -1.2 },
  weekly: [
    { weekStart: "2026-10-12", kept: 2, broke: 0, rate: 100 },
    { weekStart: "2026-10-19", kept: 1, broke: 1, rate: 50 },
    { weekStart: "2026-10-26", kept: 0, broke: 0, rate: null },
  ],
  brokenTrades: [
    {
      id: "t1",
      entryAt: "2026-10-20T01:00:00Z",
      side: "sell",
      pips: -8,
      rMultiple: -1.5,
      pnlJpy: -8000,
    },
  ],
  brokenTotal: 2,
  validation: null,
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/rules/r1"]}>
        <Routes>
          <Route path="/rules/:id" element={<RuleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RuleDetailPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("遵守率・平均R・破ったトレードを n つきで表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByText("SLを必ず入れる")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/rules/r1");
    expect(screen.getByText("直近4週の遵守率")).toBeInTheDocument();
    expect(screen.getAllByText("75%")).toHaveLength(2); // 直近4週と全期間（6/8）
    expect(screen.getByText("n=8")).toBeInTheDocument();
    expect(screen.getByText("+0.80R")).toBeInTheDocument();
    expect(screen.getByText("−1.20R")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /−1.50R/ })).toHaveAttribute(
      "href",
      "/trades/t1",
    );
  });

  it("判定のない週は「—」と表示する（0%にしない）", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    renderPage();
    const chart = await screen.findByLabelText("遵守率の週次推移");
    expect(chart).toHaveTextContent("—");
    expect(chart).toHaveTextContent("50%");
  });

  it("判定のあるトレードが無ければ、入れ方を案内する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      detail({
        kept: 0,
        broke: 0,
        brokenTrades: [],
        brokenTotal: 0,
        recent: { weeks: 4, kept: 0, broke: 0, rate: null },
      }),
    );
    renderPage();
    expect(
      await screen.findByText("まだ判定のあるトレードがありません"),
    ).toBeInTheDocument();
  });

  it("検証中のルールなら、前後の比較を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      detail({
        validation: {
          ruleId: "r1",
          title: "SLを必ず入れる",
          startedAt: "2026-10-10T00:00:00Z",
          count: 4,
          target: 10,
          reached: false,
          before: { n: 5, avgR: -0.2 },
          after: { n: 4, avgR: 0.3 },
          kept: { n: 3, avgR: 0.5 },
          broken: { n: 1, avgR: -0.4 },
        },
      }),
    );
    renderPage();
    expect(await screen.findByText("検証中の改善ルール")).toBeInTheDocument();
    expect(screen.getByText(/あと6件ほど記録/)).toBeInTheDocument();
  });

  it("取得に失敗したら再読み込みできる", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });
});
