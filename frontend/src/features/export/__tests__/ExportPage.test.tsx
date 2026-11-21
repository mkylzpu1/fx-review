import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ExportPage } from "../pages/ExportPage";
import { apiClient } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const result = (over = {}) => ({
  content: "# FXトレード振り返り分析の依頼\n本文",
  filename: "fx-review-2026-10-24.md",
  mime: "text/markdown",
  tradeCount: 12,
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastBody = () => {
  const calls = vi.mocked(apiClient.post).mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
};

describe("エクスポート", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ items: [] });
  });

  it("既定は すべて・Markdown・全項目ON で生成し、プレビューを出す", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(result());
    renderPage();
    expect(await screen.findByLabelText("出力プレビュー")).toHaveTextContent(
      "FXトレード振り返り分析の依頼",
    );
    expect(apiClient.post).toHaveBeenCalledWith("/export", {
      format: "markdown",
      include: {
        result: true,
        planDiff: true,
        rationale: true,
        ruleChecks: true,
        reflection: true,
        market: true,
      },
    });
    expect(screen.getByText("12件")).toBeInTheDocument();
  });

  it("期間・形式・含める項目を変えると、その内容で生成し直す", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(result());
    renderPage();
    await screen.findByLabelText("出力プレビュー");
    await userEvent.click(screen.getByRole("button", { name: "過去30日" }));
    await userEvent.click(screen.getByRole("radio", { name: /CSV/ }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: /計画と実際の差/ }),
    );
    await waitFor(() => {
      const b = lastBody();
      expect(typeof b.from).toBe("string");
      expect(b.to).toBeUndefined();
      expect(b.format).toBe("csv");
      expect((b.include as Record<string, boolean>).planDiff).toBe(false);
    });
  });

  it("「期間を指定」を選ぶと開始日・終了日の入力欄が出て、その範囲で生成する", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(result());
    renderPage();
    await screen.findByLabelText("出力プレビュー");
    await userEvent.click(screen.getByRole("button", { name: "期間を指定" }));
    const fromInput = screen.getByLabelText("開始日");
    const toInput = screen.getByLabelText("終了日");
    fireEvent.change(fromInput, { target: { value: "2026-10-01" } });
    fireEvent.change(toInput, { target: { value: "2026-10-15" } });
    await waitFor(() => {
      const b = lastBody();
      // customRange()はJSTの日付をUTCのISOに変換する。終了日は「翌日0時」を上限にする
      expect(b.from).toBe("2026-09-30T15:00:00.000Z");
      expect(b.to).toBe("2026-10-15T15:00:00.000Z");
    });
  });

  it("「全データをコピー」でプレビューではなく全文をコピーし、成功を知らせる", async () => {
    const long = "あ".repeat(7000);
    vi.mocked(apiClient.post).mockResolvedValue(result({ content: long }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPage();
    await screen.findByLabelText("出力プレビュー");
    expect(screen.getByLabelText("出力プレビュー")).toHaveTextContent(
      "以降はコピー・ダウンロードに含まれます",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "全データをコピー" }),
    );
    expect(writeText).toHaveBeenCalledWith(long);
    expect(useToastStore.getState().items[0]).toMatchObject({
      kind: "success",
    });
  });

  it("コピーに失敗したら、直し方つきのエラーを残す", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(result());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    renderPage();
    await screen.findByLabelText("出力プレビュー");
    await userEvent.click(
      screen.getByRole("button", { name: "全データをコピー" }),
    );
    await waitFor(() =>
      expect(useToastStore.getState().items[0]).toMatchObject({
        kind: "error",
      }),
    );
    expect(useToastStore.getState().items[0].message).toContain("ダウンロード");
  });

  it("0件なら期間を広げるよう案内し、生成に失敗したら再読み込みできる", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(result({ tradeCount: 0 }));
    renderPage();
    expect(
      await screen.findByText(/この期間のトレードがありません/),
    ).toBeInTheDocument();
  });

  it("取得に失敗したら再読み込みできる", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("x"));
    renderPage();
    expect(
      await screen.findByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "全データをコピー" }),
    ).toBeDisabled();
  });
});
