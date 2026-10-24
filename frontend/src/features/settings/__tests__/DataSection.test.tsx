import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DataSection } from "../components/DataSection";
import { apiClient } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));
vi.mock("../hooks/useCandleSync", async (orig) => ({
  ...(await orig<typeof import("../hooks/useCandleSync")>()),
  CANDLE_SYNC_URL: "http://localhost:3100",
}));
const download = vi.hoisted(() => vi.fn());
vi.mock("@/features/export/utils/download", () => ({ downloadText: download }));

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DataSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const toasts = () => useToastStore.getState().items.map((t) => t.message);

describe("データ設定", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useToastStore.setState({ items: [] });
  });

  it("バックアップを取得して、JSONファイルとして保存する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      app: "fx-review",
      version: 1,
    });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "JSONを保存" }));
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(apiClient.get).toHaveBeenCalledWith("/backup");
    expect(download.mock.calls[0][1]).toMatch(
      /^fx-review-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it("復元は、確認ダイアログで承諾するまで送らない", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ trades: 3 });
    renderIt();
    const file = new File(
      ['{"app":"fx-review","version":1,"data":{}}'],
      "b.json",
      {
        type: "application/json",
      },
    );
    await userEvent.upload(
      screen.getByLabelText("バックアップのJSONファイル"),
      file,
    );
    expect(
      await screen.findByText("バックアップから復元しますか？"),
    ).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "復元する" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/backup/restore", {
        app: "fx-review",
        version: 1,
        data: {},
      }),
    );
    await waitFor(() =>
      expect(toasts()).toContain("バックアップから復元しました（トレード3件）"),
    );
  });

  it("別のファイルを選んだら、送らずにエラーを出す", async () => {
    renderIt();
    await userEvent.upload(
      screen.getByLabelText("バックアップのJSONファイル"),
      new File(["hello"], "x.json", { type: "application/json" }),
    );
    await waitFor(() =>
      expect(toasts().join()).toMatch(/JSONとして読み込めませんでした/),
    );
    expect(
      screen.queryByText("バックアップから復元しますか？"),
    ).not.toBeInTheDocument();
  });

  it("全削除は確認してから実行し、キャンセルなら何もしない", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ deleted: true });
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(apiClient.delete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    const confirm = screen.getByRole("button", { name: "すべて削除" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/確認のため/), "削除");
    await userEvent.click(confirm);
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith("/data"));
  });

  it("復元に失敗したら、いまのデータが変わっていないことを伝える", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("通信エラー"));
    renderIt();
    await userEvent.upload(
      screen.getByLabelText("バックアップのJSONファイル"),
      new File(['{"app":"fx-review"}'], "b.json", { type: "application/json" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "復元する" }),
    );
    await waitFor(() => expect(toasts()).toHaveLength(1));
  });

  it("ローソク足の更新ボタンは、同期サーバーに直近7日を依頼して結果を知らせる", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        fetched: 120,
        excursion: { total: 2, withData: 2 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "更新" }));
    await waitFor(() =>
      expect(toasts().some((m) => m.includes("120本"))).toBe(true),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3100/sync");
    expect(JSON.parse(init.body)).toEqual({ days: 7 });
    vi.unstubAllGlobals();
  });

  it("同期サーバーに届かないときは、起動の確認を促す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    renderIt();
    await userEvent.click(screen.getByRole("button", { name: "更新" }));
    await waitFor(() =>
      expect(toasts().some((m) => m.includes("make dev"))).toBe(true),
    );
    vi.unstubAllGlobals();
  });
});
