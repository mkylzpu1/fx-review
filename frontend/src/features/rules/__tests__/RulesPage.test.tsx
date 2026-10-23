import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RulesPage } from "../pages/RulesPage";
import { apiClient } from "@/services/apiClient";
import type { Rule } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const rule = (o: Partial<Rule> = {}): Rule => ({
  id: "r1",
  title: "SLを入れてから発注",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: "sl_set",
  validationTargetN: 10,
  validationStartedAt: null,
  ...o,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RulesPage />
    </QueryClientProvider>,
  );
}

describe("ルール画面", () => {
  beforeEach(() => vi.clearAllMocks());

  it("0件のときは空状態を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText("ルールはまだありません")).toBeTruthy();
  });

  it("ルール名が空だと項目直下にエラーを出し、送信しない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });
    renderPage();
    await userEvent.click(await screen.findByText("最初のルールを追加"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "ルール名を入力してください",
    );
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("有効なルールを無効にするときは確認する（キャンセルで変更しない）", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [rule()] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "有効" }));
    expect(screen.getByText("このルールを無効にしますか？")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it("無効にする確認でOKすると isActive=false を送る", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [rule()] });
    vi.mocked(apiClient.put).mockResolvedValue(rule({ isActive: false }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "有効" }));
    await userEvent.click(screen.getByRole("button", { name: "無効にする" }));
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith("/rules/r1", {
        isActive: false,
      }),
    );
  });
});
