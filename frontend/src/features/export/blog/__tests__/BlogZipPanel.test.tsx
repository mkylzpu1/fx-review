import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useToastStore } from "@/stores/toastStore";
import { BlogZipPanel } from "../BlogZipPanel";
import { downloadBlob } from "../../utils/download";
import { generateImages } from "../generateImages";
import { makeTrade } from "./fixtures";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));
vi.mock("../../utils/download", () => ({
  downloadBlob: vi.fn(),
  downloadText: vi.fn(),
}));
// チャートの描画（画像生成）はモックにする
vi.mock("../generateImages", async (orig) => ({
  ...(await orig<typeof import("../generateImages")>()),
  generateImages: vi.fn(),
}));

const settings = {
  balanceJpy: 1_000_000,
  maxRiskPct: 1,
  minRr: 2,
  timezone: "Asia/Tokyo",
  chartDefaultTf: "1h",
  chartBarsBefore: 60,
  chartBarsAfter: 40,
  emaSettings: [{ period: 20, visible: true }],
};

function mockApi(trades: ReturnType<typeof makeTrade>[]) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url.startsWith("/settings")) return settings;
    if (url.startsWith("/currency-pairs")) return { items: [] };
    if (url.startsWith("/trades"))
      return { items: trades, total: trades.length, page: 1, limit: 100 };
    throw new Error(`unexpected GET ${url}`);
  });
  // 足の事前チェック: 足なし
  vi.mocked(apiClient.post).mockImplementation(
    async (_url: string, body: unknown) => ({
      results: (body as { requests: unknown[] }).requests.map(() => ({
        ok: true,
        data: {
          tf: "1h",
          candles: [],
          warmupCount: 0,
          hasData: false,
          mock: false,
        },
      })),
    }),
  );
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BlogZipPanel />
    </QueryClientProvider>,
  );
}

const setDates = (from: string, to: string) => {
  fireEvent.change(screen.getByLabelText("開始日"), {
    target: { value: from },
  });
  fireEvent.change(screen.getByLabelText("終了日"), { target: { value: to } });
};
const dlButton = () =>
  screen.getByRole("button", { name: "zipをダウンロード" });

describe("ブログ用zip画面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ items: [] });
  });

  it("開始日が終了日より後ならエラーを出し、ダウンロードできない", async () => {
    mockApi([]);
    renderPanel();
    setDates("2026-10-30", "2026-10-29");
    expect(await screen.findByRole("alert")).toHaveTextContent("開始日");
    expect(dlButton()).toBeDisabled();
  });

  it("31日を超える期間はエラー、31日ちょうどはエラーにならない", async () => {
    mockApi([]);
    renderPanel();
    setDates("2026-10-01", "2026-11-01");
    expect(await screen.findByRole("alert")).toHaveTextContent("31日");
    setDates("2026-10-01", "2026-10-31");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("0件のときはメッセージを出し、zipは作れない", async () => {
    mockApi([]);
    renderPanel();
    setDates("2026-10-29", "2026-10-29");
    expect(
      await screen.findByText("この期間に出力できるトレードがありません。"),
    ).toBeInTheDocument();
    expect(dlButton()).toBeDisabled();
  });

  it("プレビューに件数・メモ未入力・ローソク足なしを出し、完了後に警告の一覧を出す", async () => {
    mockApi([
      makeTrade({ entryAt: "2026-10-29T01:00:00Z", rationaleMemo: null }),
      makeTrade({ entryAt: "2026-10-29T02:00:00Z" }),
    ]);
    vi.mocked(generateImages).mockResolvedValue({
      charts: new Map(),
      images: new Map(),
    });
    renderPanel();
    setDates("2026-10-29", "2026-10-29");
    expect(await screen.findByText(/2026-10-29: 2件/)).toBeInTheDocument();
    expect(screen.getByText(/根拠メモ未入力 1件/)).toBeInTheDocument();
    expect((await screen.findAllByText(/ローソク足なし/)).length).toBe(2);

    await userEvent.click(dlButton());
    const list = await screen.findByLabelText("警告の一覧");
    expect(list).toHaveTextContent("根拠メモ未入力");
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe(
      "tremiru-blog_2026-10-29_2026-10-29.zip",
    );
  });

  it("除外したトレードは、件数・画像枚数・出力から外れる", async () => {
    mockApi([
      makeTrade({ entryAt: "2026-10-29T01:00:00Z" }),
      makeTrade({ entryAt: "2026-10-29T02:00:00Z" }),
    ]);
    renderPanel();
    setDates("2026-10-29", "2026-10-29");
    expect(await screen.findByText("2件・画像6枚")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("checkbox", { name: /USDJPY.+を含める/ })[0],
    );
    expect(await screen.findByText("1件・画像3枚")).toBeInTheDocument();
  });

  it("画像が90枚を超えるときは確認し、キャンセルなら作らない", async () => {
    // 31件 × 3枚 = 93枚
    mockApi(
      Array.from({ length: 31 }, (_, i) =>
        makeTrade({
          entryAt: `2026-10-29T${String(Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 10).padStart(2, "0")}:00Z`,
        }),
      ),
    );
    renderPanel();
    setDates("2026-10-29", "2026-10-29");
    expect(await screen.findByText("31件・画像93枚")).toBeInTheDocument();
    await userEvent.click(dlButton());
    expect(await screen.findByText("画像が多くなります")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(generateImages).not.toHaveBeenCalled();
  });

  it("作成中は n/m枚 を表示し、キャンセルするとzipを作らない", async () => {
    mockApi([makeTrade({ entryAt: "2026-10-29T01:00:00Z" })]);
    vi.mocked(generateImages).mockImplementation(
      (i) =>
        new Promise((_, reject) => {
          i.onProgress?.(1, 3);
          i.signal?.addEventListener("abort", () =>
            reject(new DOMException("x", "AbortError")),
          );
        }),
    );
    renderPanel();
    setDates("2026-10-29", "2026-10-29");
    await screen.findByText(/2026-10-29: 1件/);
    await userEvent.click(dlButton());
    expect(await screen.findByRole("status")).toHaveTextContent("1/3枚");
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(useToastStore.getState().items[0].message).toContain("キャンセル");
  });
});
