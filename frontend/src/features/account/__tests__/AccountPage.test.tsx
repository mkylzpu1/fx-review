import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AccountPage } from "../pages/AccountPage";
import { apiClient } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/components/AuthProvider", () => ({
  useAuthContext: () => ({
    user: { userId: "u1", email: "me@example.com", name: "Taro" },
    isAuthenticated: true,
    isLoading: false,
    signOut,
  }),
}));

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<p>ログイン画面</p>} />
          <Route path="/export" element={<p>エクスポート画面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const toasts = () => useToastStore.getState().items.map((t) => t.message);

describe("アカウント画面", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    signOut.mockResolvedValue(undefined);
    useToastStore.setState({ items: [] });
  });

  it("名前とメールを読み取り専用で表示する（入力欄は無い）", () => {
    renderIt();
    expect(screen.getByText("Taro")).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("ログアウトするとログイン画面へ移る", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(screen.getByText("ログイン画面")).toBeVisible());
    expect(signOut).toHaveBeenCalled();
  });

  it("「先にエクスポート」でエクスポート画面へ移る", async () => {
    renderIt();
    await userEvent.click(
      screen.getByRole("link", { name: "先にエクスポート" }),
    );
    expect(screen.getByText("エクスポート画面")).toBeVisible();
  });

  it("退会は「退会」と入力するまで実行できず、キャンセルでは送らない", async () => {
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "退会する" }));
    const dialog = screen.getByRole("dialog");
    const confirm = dialog.querySelector("button.btn-danger") as HTMLElement;
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/確認のため/), "たいかい");
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it("「退会」と入力して実行すると DELETE /auth/me を送り、ログイン画面へ移る", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ message: "退会しました" });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "退会する" }));
    await userEvent.type(screen.getByLabelText(/確認のため/), "退会");
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      dialog.querySelector("button.btn-danger") as HTMLElement,
    );
    await waitFor(() => expect(screen.getByText("ログイン画面")).toBeVisible());
    expect(apiClient.delete).toHaveBeenCalledWith("/auth/me");
    expect(signOut).toHaveBeenCalled();
  });

  it("退会に失敗したら、データは変わっていないことを伝え、画面に留まる", async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error("x"));
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "退会する" }));
    await userEvent.type(screen.getByLabelText(/確認のため/), "退会");
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      dialog.querySelector("button.btn-danger") as HTMLElement,
    );
    await waitFor(() =>
      expect(toasts().some((m) => m.includes("データは変わっていません"))).toBe(
        true,
      ),
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.queryByText("ログイン画面")).not.toBeInTheDocument();
  });
});
