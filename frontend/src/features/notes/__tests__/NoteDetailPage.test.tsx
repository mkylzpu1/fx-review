import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NoteDetailPage } from "../pages/NoteDetailPage";
import { apiClient, ApiError } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";
import type { NoteDetail } from "../types";

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

const detail = (over: Partial<NoteDetail> = {}): NoteDetail => ({
  id: "n1",
  kind: "ai",
  title: "Claudeの分析",
  body: "総評です。",
  aiName: "Claude",
  dataRangeLabel: "直近30日",
  rawResponse: "## 改善案\n- SLを入れる",
  emotionTags: [],
  nextRule: null,
  sourceTradeId: null,
  createdAt: "2026-10-24T01:00:00Z",
  sections: [{ heading: "改善案", lines: ["- SLを入れる"] }],
  improvements: [
    {
      id: "i1",
      noteId: "n1",
      position: 0,
      text: "SLを必ず入れる",
      sampleN: 8,
      status: "needs_check",
      ruleId: null,
      validation: null,
    },
    {
      id: "i2",
      noteId: "n1",
      position: 1,
      text: "連敗3回で終了",
      sampleN: null,
      status: "ruled",
      ruleId: "r2",
      validation: { count: 3, target: 10 },
    },
  ],
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/notes/n1"]}>
        <Routes>
          <Route path="/notes/:id" element={<NoteDetailPage />} />
          <Route path="/notes" element={<p>メモ一覧ページ</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AI分析の結果ビュー", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ items: [] });
  });

  it("要約・改善提案（優先順）・状態（要検証 n= / 検証中 x/10）を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByText("総評です。")).toBeInTheDocument();
    const items = screen
      .getAllByRole("listitem")
      .filter((li) => li.textContent?.includes("優先"));
    expect(items[0]).toHaveTextContent("優先 1");
    expect(items[0]).toHaveTextContent("要検証 n=8");
    expect(items[1]).toHaveTextContent("検証中 3/10");
    expect(screen.getByRole("link", { name: "ルールを見る" })).toHaveAttribute(
      "href",
      "/rules/r2",
    );
  });

  it("「ルールに追加」でAPIを呼び、成功を知らせる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    vi.mocked(apiClient.post).mockResolvedValue({ id: "r1" });
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "ルールに追加" }),
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/notes/n1/improvements/i1/to-rule",
      {},
    );
    await waitFor(() =>
      expect(useToastStore.getState().items[0]).toMatchObject({
        kind: "success",
      }),
    );
  });

  it("すでにルール化済み(409)なら、その旨をエラーで知らせる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError("CONFLICT", "x", 409),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "ルールに追加" }),
    );
    await waitFor(() =>
      expect(useToastStore.getState().items[0]).toMatchObject({
        kind: "error",
      }),
    );
    expect(useToastStore.getState().items[0].message).toContain(
      "すでにルールにしています",
    );
  });

  it("パースできなかった回答は、原文をそのまま出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      detail({
        sections: [],
        improvements: [],
        rawResponse: "自由文の回答です。",
      }),
    );
    renderPage();
    expect(await screen.findByText("回答（原文）")).toBeInTheDocument();
    expect(screen.getByText("自由文の回答です。")).toBeInTheDocument();
    expect(screen.queryByText("改善提案")).toBeNull();
  });

  it("構造のある回答でも「原文を見る」で原文を確認できる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByText("原文を見る")).toBeInTheDocument();
  });

  it("削除は確認を挟み、キャンセルに初期フォーカス。実行すると一覧へ戻る", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(detail());
    vi.mocked(apiClient.delete).mockResolvedValue({ id: "n1" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "削除" }));
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
    expect(apiClient.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(apiClient.delete).toHaveBeenCalledWith("/notes/n1");
    expect(await screen.findByText("メモ一覧ページ")).toBeInTheDocument();
  });

  it("自分の気づきは、本文・次回のルール・感情タグを出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      detail({
        kind: "self",
        aiName: null,
        body: "焦って入った",
        nextRule: "30分待つ",
        emotionTags: ["焦り"],
        improvements: [],
        sections: [],
        rawResponse: null,
      }),
    );
    renderPage();
    expect(await screen.findByText("焦って入った")).toBeInTheDocument();
    expect(screen.getByText("30分待つ")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "感情タグ" })).toHaveTextContent(
      "焦り",
    );
  });
});
