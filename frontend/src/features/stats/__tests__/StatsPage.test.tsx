import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { StatsPage } from "../pages/StatsPage";
import { apiClient } from "@/services/apiClient";
import type { StatsResult } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const stats = (over: Partial<StatsResult> = {}): StatsResult => ({
  summary: {
    n: 40,
    winRate: 55,
    totalPips: 120.5,
    totalPnlJpy: 12000,
    rCount: 10,
    rMissing: 30,
    avgR: 0.4,
    totalR: 4,
    profitFactor: 1.5,
    maxLossStreak: 4,
  },
  cumulative: [
    { index: 1, entryAt: "2026-10-01T00:00:00Z", r: 1, cumulative: 1 },
    { index: 2, entryAt: "2026-10-02T00:00:00Z", r: -2, cumulative: -1 },
  ],
  drawdown: { depth: 2, peakIndex: 1, troughIndex: 2 },
  daily: [
    {
      date: "2026-10-01",
      n: 2,
      wins: 1,
      pips: 20,
      pnlJpy: 2000,
      r: 1,
      rCount: 1,
      cumulativePips: 20,
      cumulativePnlJpy: 2000,
      cumulativeR: 1,
    },
    {
      date: "2026-10-02",
      n: 1,
      wins: 0,
      pips: -8,
      pnlJpy: -800,
      r: 0,
      rCount: 0,
      cumulativePips: 12,
      cumulativePnlJpy: 1200,
      cumulativeR: 1,
    },
  ],
  bySession: [
    {
      key: "tokyo",
      label: "東京",
      n: 6,
      avgR: 0.5,
      verdict: "needs_check",
      shortfall: 9,
    },
  ],
  byRationale: [
    {
      key: "__unset__",
      label: "未入力",
      n: 4,
      avgR: 0.1,
      verdict: "needs_check",
      shortfall: 11,
    },
  ],
  byRule: [],
  byWeekday: [],
  byHour: [],
  byHolding: [],
  byLots: [],
  insights: [
    {
      kind: "needs_check",
      axis: "session",
      label: "東京",
      n: 6,
      avgR: 0.5,
      shortfall: 9,
    },
    {
      kind: "weakness",
      axis: "rationale",
      label: "逆張り",
      n: 20,
      avgR: -0.3,
      shortfall: 0,
    },
  ],
  closedCount: 40,
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("統計", () => {
  beforeEach(() => vi.clearAllMocks());

  it("指標・n・R未計算の件数・最大DDの帯を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(stats());
    renderPage();
    expect((await screen.findAllByText("55.0%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("R計算 n=10")).toHaveLength(2);
    expect(screen.getByText(/SLが入っていない30件/)).toBeInTheDocument();
    expect(screen.getByTestId("drawdown-band")).toBeInTheDocument();
    expect(screen.getByText("n=6")).toBeInTheDocument();
  });

  it("データから見えること: 要検証は断定せず「あと◯件」、弱みは候補として示す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(stats());
    renderPage();
    const box = within(
      (await screen.findByText("データから見えること")).closest("section")!,
    );
    expect(box.getByText(/あと9件ほど記録してから判断/)).toBeInTheDocument();
    expect(box.getByText(/逆張り.*弱みの候補/)).toBeInTheDocument();
    expect(
      box.getByRole("link", { name: "AIに分析してもらう" }),
    ).toHaveAttribute("href", "/export");
  });

  it("期間を切り替えると from を付けて取り直す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(stats());
    renderPage();
    await screen.findAllByText("55.0%");
    await userEvent.click(screen.getByRole("button", { name: "過去30日" }));
    const paths = vi
      .mocked(apiClient.get)
      .mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => p.startsWith("/stats?from="))).toBe(true);
    expect(paths[0]).toContain("/stats");
  });

  it("前の期間との比較を出し、期間「すべて」では出さない", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
      path.includes("to=")
        ? stats({ summary: { ...stats().summary, winRate: 40, n: 10 } })
        : stats(),
    );
    renderPage();
    const box = within(
      (
        await screen.findByRole("heading", { name: "前の期間との比較" })
      ).closest("section")!,
    );
    expect(box.getByText("40.0%")).toBeInTheDocument();
    expect(box.getByText("+15.0pt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "すべて" }));
    await screen.findAllByText("55.0%");
    expect(
      screen.queryByRole("heading", { name: "前の期間との比較" }),
    ).not.toBeInTheDocument();
  });

  it("日々の成長: 累積の折れ線と日ごとの棒を出し、指標を切り替えられる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(stats());
    renderPage();
    const box = within(
      (await screen.findByRole("heading", { name: "日々の成長" })).closest(
        "section",
      )!,
    );
    expect(box.getByTestId("cumulative-line")).toBeInTheDocument();
    expect(box.getAllByTestId("day-bar")).toHaveLength(2);
    expect(box.getByText("+¥1,200")).toBeInTheDocument();
    expect(box.getByText(/2日（プラス1日・マイナス1日）/)).toBeInTheDocument();

    await userEvent.click(box.getByRole("button", { name: "pips" }));
    expect(box.getByText("+12.0 pips")).toBeInTheDocument();

    // R が計算できていない日は棒を出さない
    await userEvent.click(box.getByRole("button", { name: "R" }));
    expect(box.getAllByTestId("day-bar")).toHaveLength(1);
    expect(box.getByText("+1.00R")).toBeInTheDocument();
  });

  it("0件なら空状態と取り込みへの導線", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      stats({ closedCount: 0, cumulative: [], drawdown: null, daily: [] }),
    );
    renderPage();
    expect(
      await screen.findByText("まだ集計できるトレードがありません"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSVを取り込む" })).toHaveAttribute(
      "href",
      "/trades/import",
    );
  });

  it("取得に失敗したら再読み込みできる", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });
});

describe("統計 古いAPI", () => {
  it("新しい切り口が無い応答でも画面が落ちない", async () => {
    const old = stats() as Partial<StatsResult>;
    delete old.byWeekday;
    delete old.byHour;
    delete old.byHolding;
    delete old.byLots;
    delete old.daily;
    vi.mocked(apiClient.get).mockResolvedValue(old);
    renderPage();
    expect(await screen.findByText("曜日別")).toBeInTheDocument();
  });
});
