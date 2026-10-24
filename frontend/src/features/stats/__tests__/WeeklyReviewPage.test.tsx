import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { WeeklyReviewPage } from "../pages/WeeklyReviewPage";
import { apiClient } from "@/services/apiClient";
import type { WeeklyResult } from "../weeklyTypes";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const weekly = (over: Partial<WeeklyResult> = {}): WeeklyResult => ({
  weekStart: "2026-10-19",
  weekEnd: "2026-10-25",
  n: 4,
  winRate: 50,
  totalR: 1.5,
  rCount: 3,
  rMissing: 1,
  totalPips: 12.3,
  rule: { kept: 2, broke: 1, none: 1 },
  days: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-${19 + i}`,
    n: i === 0 ? 4 : 0,
    r: i === 0 ? 1.5 : 0,
    rCount: i === 0 ? 3 : 0,
  })),
  planned: {
    eligibleCount: 1,
    excludedCount: 2,
    actualR: 0.5,
    plannedTotalR: 3,
    diffR: 1.5,
    emotions: [{ name: "焦り", n: 1 }],
  },
  trades: [
    {
      id: "t1",
      entryAt: "2026-10-19T01:00:00Z",
      side: "buy",
      pips: 5,
      rMultiple: 1,
      pnlJpy: 5000,
      deviation: true,
    },
  ],
  comments: [
    {
      kind: "note",
      text: "4件と少ないため、傾向ではなく見直しの材料として見てください。",
    },
  ],
  fewTrades: true,
  review: null,
  rules: [{ id: "r1", title: "SLを必ず入れる" }],
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <WeeklyReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WeeklyReviewPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("集計・計画どおりR・対象外件数・少件数の注記を表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(weekly());
    renderPage();
    expect(
      await screen.findByText("10/19（月）〜 10/25（日）"),
    ).toBeInTheDocument();
    expect(screen.getByText(/TPまたはSLが無い手動決済2件/)).toBeInTheDocument();
    expect(screen.getByText(/傾向ではなく見直しの材料/)).toBeInTheDocument();
    expect(screen.getByText("ルール逸脱")).toBeInTheDocument();
  });

  it("前の週を押すと、前の週を取得する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(weekly());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "前の週" }),
    );
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith(
        "/weekly-review?weekStart=2026-10-12",
      ),
    );
  });

  it("トレードが0件の週は空状態になり、ふりかえりは書ける", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      weekly({ n: 0, trades: [], comments: [] }),
    );
    renderPage();
    expect(
      await screen.findByText("この週の決済済みトレードはありません"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("1週間のふりかえり")).toBeInTheDocument();
  });

  it("ふりかえりと来週のルールを保存する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(weekly());
    vi.mocked(apiClient.put).mockResolvedValue({});
    renderPage();
    await userEvent.selectOptions(
      await screen.findByLabelText("来週守るルールを1つ選ぶ"),
      "r1",
    );
    await userEvent.type(
      screen.getByLabelText("1週間のふりかえり"),
      "焦って手動決済した",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        "/weekly-review?weekStart=2026-10-19",
        {
          memo: "焦って手動決済した",
          nextRuleId: "r1",
          nextRuleText: null,
        },
      ),
    );
  });

  it("保存して学習メモに残すと、メモを作成する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(weekly());
    vi.mocked(apiClient.put).mockResolvedValue({});
    vi.mocked(apiClient.post).mockResolvedValue({});
    renderPage();
    await userEvent.type(
      await screen.findByLabelText("1週間のふりかえり"),
      "メモ",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "保存して学習メモに残す" }),
    );
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/notes", {
        title: "週次レビュー 10/19（月）〜 10/25（日）",
        body: "メモ",
        nextRule: null,
      }),
    );
  });

  it("取得に失敗したら再試行を出す", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });
});
