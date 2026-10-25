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
    vi.mocked(apiClient.post).mockImplementation(async (_url, body) => ({
      results: (body as { requests: { tf: string }[] }).requests.map((r) => ({
        ok: true,
        data: {
          tf: r.tf,
          candles: [],
          warmupCount: 0,
          hasData: false,
          mock: false,
        },
      })),
    }));
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
      const reqs = vi
        .mocked(apiClient.post)
        .mock.calls.filter((c) => c[0] === "/candles/batch")
        .flatMap((c) => (c[1] as { requests: { tf: string }[] }).requests)
        .filter((r) => r.tf === "15m");
      expect(reqs.length).toBeGreaterThanOrEqual(2);
    });
    // 行ごとに /candles を個別に呼ばない（まとめて取得する）
    expect(
      vi
        .mocked(apiClient.get)
        .mock.calls.some((c) => (c[0] as string).startsWith("/candles")),
    ).toBe(false);
    expect(within(group).getByRole("button", { name: "15分" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("合計は表示中の20件ではなく、条件に合う全件（100件を超えても）から出す", async () => {
    const mk = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        trade({ id: `t${from + i}`, pips: 10, pnlJpy: 1000 }),
      );
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      const sp = new URLSearchParams(url.split("?")[1] ?? "");
      if (!url.startsWith("/trades?") && url !== "/trades") return page([]);
      const limit = Number(sp.get("limit"));
      const pg = Number(sp.get("page"));
      if (limit === 100)
        return { ...page(pg === 1 ? mk(0, 100) : mk(100, 50), 150), page: pg };
      return page(mk(0, 20), 150);
    });
    renderPage();
    await screen.findByRole("table");
    // 150件 × 1,000円
    expect(await screen.findByText("+¥150,000")).toBeInTheDocument();
    expect(screen.getByText("+1500.0 pips")).toBeInTheDocument();
  });

  it("全件の集計は、1ページ目で総件数が分かったら、残りのページをまとめて取りに行く", async () => {
    const mk = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        trade({ id: `t${from + i}`, pips: 10, pnlJpy: 1000 }),
      );
    const inFlight = { now: 0, max: 0 };
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      const sp = new URLSearchParams(url.split("?")[1] ?? "");
      if (!url.startsWith("/trades?") && url !== "/trades") return page([]);
      const limit = Number(sp.get("limit"));
      const pg = Number(sp.get("page"));
      if (limit !== 100) return page(mk(0, 20), 450);
      inFlight.now++;
      inFlight.max = Math.max(inFlight.max, inFlight.now);
      await new Promise((r) => setTimeout(r, 5));
      inFlight.now--;
      return {
        ...page(mk((pg - 1) * 100, pg === 5 ? 50 : 100), 450),
        page: pg,
      };
    });
    renderPage();
    await screen.findByRole("table");
    // 450件 × 1,000円（5ページ）
    expect(await screen.findByText("+¥450,000")).toBeInTheDocument();
    // 2ページ目以降は同時に取得している（1ページずつ待たない）
    expect(inFlight.max).toBeGreaterThan(1);
    // 再描画のたびに取り直さない（1ページ目の取得は1回だけ）
    const firstPages = vi
      .mocked(apiClient.get)
      .mock.calls.filter(
        (c) =>
          (c[0] as string).includes("page=1&limit=100") &&
          (c[0] as string).startsWith("/trades?"),
      );
    expect(firstPages).toHaveLength(1);
  });

  it("読み込み中でも画面全体は止めず、見出し・絞り込みは操作でき、読み込み表示は一覧の場所だけに出す", async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(
      screen.getByRole("heading", { name: "トレード" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "トレードを記録" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "負け" })).toBeEnabled();
    expect(
      screen.getByRole("status", { name: "読み込み中" }),
    ).toBeInTheDocument();
  });

  it("絞り込みで取り直している間も、表の行は押せる（薄く無効にしない）", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(page([trade()]));
    renderPage();
    await screen.findByRole("table");
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    await userEvent.click(screen.getByRole("button", { name: "負け" }));
    const table = await screen.findByRole("table");
    expect(table.parentElement?.className ?? "").not.toContain(
      "pointer-events-none",
    );
    expect(table.closest("[aria-busy='true']")).toBeNull();
  });
});
