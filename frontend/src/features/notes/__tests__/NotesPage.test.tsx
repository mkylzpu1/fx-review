import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NotesPage } from "../pages/NotesPage";
import { apiClient } from "@/services/apiClient";
import type { NoteListItem, RuleValidation } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

const item = (over: Partial<NoteListItem> = {}): NoteListItem => ({
  id: "n1",
  kind: "ai",
  title: "Claudeの分析 2026-10-24",
  body: "全体として東京時間が強いです。",
  aiName: "Claude",
  dataRangeLabel: "直近30日",
  rawResponse: null,
  emotionTags: [],
  nextRule: null,
  sourceTradeId: null,
  createdAt: "2026-10-24T01:00:00Z",
  improvementCount: 3,
  ruledCount: 1,
  ...over,
});

const validation: RuleValidation = {
  ruleId: "r1",
  title: "SLを必ず入れる",
  startedAt: "2026-10-10T00:00:00Z",
  count: 4,
  target: 10,
  reached: false,
  before: { n: 20, avgR: -0.1 },
  after: { n: 4, avgR: 0.3 },
  kept: { n: 3, avgR: 0.5 },
  broken: { n: 1, avgR: -0.4 },
};

function mockGet(items: NoteListItem[], validations: RuleValidation[] = []) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
    if (path.startsWith("/notes/validations")) return { items: validations };
    return { items, total: items.length, page: 1, limit: 10 };
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notes"]}>
        <Routes>
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<p>詳細ページ</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("学習メモ", () => {
  beforeEach(() => vi.clearAllMocks());

  it("メモ一覧に種別・改善案の件数・検証中を出す", async () => {
    mockGet([item()]);
    renderPage();
    expect(
      await screen.findByRole("link", { name: "Claudeの分析 2026-10-24" }),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "メモ一覧" });
    expect(list).toHaveTextContent("AIの分析");
    expect(list).toHaveTextContent("検証中 1件");
    expect(list).toHaveTextContent("改善案 3件");
  });

  it("検証中の改善ルール: ルール化後の件数と、前後・守った時/破った時の平均R", async () => {
    mockGet([item()], [validation]);
    renderPage();
    const panel = await screen.findByRole("region", {
      name: "検証中の改善ルール",
    });
    expect(panel).toHaveTextContent("ルール化後 4 / 目標10件");
    expect(panel).toHaveTextContent("守った時の平均R");
    expect(panel).toHaveTextContent("あと6件ほど記録すると");
  });

  it("絞り込みは種別・検証中のクエリで取り直す", async () => {
    mockGet([item()]);
    renderPage();
    await screen.findByRole("list", { name: "メモ一覧" });
    await userEvent.click(screen.getByRole("button", { name: "検証中" }));
    await userEvent.click(screen.getByRole("button", { name: "自分の気づき" }));
    const paths = vi
      .mocked(apiClient.get)
      .mock.calls.map((c) => c[0] as string);
    expect(paths.some((p) => p.includes("validating=true"))).toBe(true);
    expect(paths.some((p) => p.includes("kind=self"))).toBe(true);
  });

  it("0件なら空状態", async () => {
    mockGet([]);
    renderPage();
    expect(
      await screen.findByText("学習メモはまだありません"),
    ).toBeInTheDocument();
  });

  it("貼り付けた回答を保存して、詳細へ移動する。回答が空なら押せない", async () => {
    mockGet([]);
    vi.mocked(apiClient.post).mockResolvedValue({ id: "new1" });
    renderPage();
    const save = await screen.findByRole("button", {
      name: "改善案を取り出して保存",
    });
    expect(save).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("使ったAI"), "ChatGPT");
    await userEvent.type(
      screen.getByLabelText("AIの回答"),
      "1. SLを必ず入れる",
    );
    await userEvent.click(save);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/notes/ai", {
        aiName: "ChatGPT",
        dataRangeLabel: "直近30日",
        rawResponse: "1. SLを必ず入れる",
      }),
    );
    expect(await screen.findByText("詳細ページ")).toBeInTheDocument();
  });

  it("保存に失敗したら、貼り付けた内容は残して直し方を示す", async () => {
    mockGet([]);
    vi.mocked(apiClient.post).mockRejectedValue(new Error("x"));
    renderPage();
    await userEvent.type(await screen.findByLabelText("AIの回答"), "回答です");
    await userEvent.click(
      screen.getByRole("button", { name: "改善案を取り出して保存" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "貼り付けた内容は残っています",
    );
    expect(screen.getByLabelText("AIの回答")).toHaveValue("回答です");
  });
});
