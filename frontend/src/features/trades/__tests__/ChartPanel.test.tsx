import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { apiClient } from "@/services/apiClient";
import type { AccountSettings } from "@/features/settings/types";
import type { CandlesResponse, Trade } from "../types";

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

const chartProps = vi.fn();
vi.mock("../components/TradeChart", () => ({
  TradeChart: (p: { data: { candles: unknown[]; emaLines: unknown[] } }) => {
    chartProps(p);
    return <div data-testid="trade-chart" />;
  },
}));

const trade = {
  id: "t1",
  pair: "USDJPY",
  side: "buy",
  entryAt: "2026-10-01T13:10:00.000Z",
  exitAt: "2026-10-01T13:40:00.000Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.4,
} as unknown as Trade;

const settings: AccountSettings = {
  balanceJpy: 1_000_000,
  maxRiskPct: 1,
  minRr: 2,
  timezone: "Asia/Tokyo",
  chartDefaultTf: "1h",
  chartBarsBefore: 40,
  chartBarsAfter: 20,
  emaSettings: [{ period: 20, visible: true }],
};

// 2026-10-01T02:00:00Z から1時間ごと。エントリー（13:10Z）は12本目の足に入る
const BASE = Date.parse("2026-10-01T02:00:00Z") / 1000;
const candles = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    time: BASE + i * 3600,
    open: 150,
    high: 150.2,
    low: 149.9,
    close: 150 + i * 0.01,
  }));

const ok = (over: Partial<CandlesResponse> = {}): CandlesResponse => ({
  tf: "1h",
  candles: candles(30),
  warmupCount: 5,
  hasData: true,
  mock: false,
  ...over,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ChartPanel trade={trade} pipSize={0.01} settings={settings} />
    </QueryClientProvider>,
  );
}

const lastUrl = () => {
  const calls = vi.mocked(apiClient.get).mock.calls;
  return new URL(calls[calls.length - 1][0] as string, "http://x");
};

describe("チャート領域", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("設定の初期時間足と、EMAのウォームアップ込みの範囲で取得する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    expect(await screen.findByTestId("trade-chart")).toBeInTheDocument();
    const u = lastUrl();
    expect(u.pathname).toBe("/candles");
    expect(u.searchParams.get("tf")).toBe("1h");
    expect(u.searchParams.get("warmup")).toBe("60"); // EMA20 × 3
    expect(screen.getByRole("radio", { name: "1h" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("時間足を切り替えると、その時間足で取り直す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    await userEvent.click(screen.getByRole("radio", { name: "15m" }));
    await waitFor(() => expect(lastUrl().searchParams.get("tf")).toBe("15m"));
  });

  it("取得に失敗したら失敗表示。再読み込みで取り直せる", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("network"));
    renderPanel();
    expect(
      await screen.findByText("足データを取得できませんでした"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("チャートがなくても、価格・根拠・結果は記録できます。"),
    ).toBeInTheDocument();
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByTestId("trade-chart")).toBeInTheDocument();
  });

  it("失敗表示の「別の時間足を見る」で次の時間足に移る", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("network"));
    renderPanel();
    await screen.findByText("足データを取得できませんでした");
    await userEvent.click(
      screen.getByRole("button", { name: "別の時間足を見る" }),
    );
    await waitFor(() => expect(lastUrl().searchParams.get("tf")).toBe("4h"));
  });

  it("該当期間に足が無いときは「データがありません」", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      ok({ candles: [], warmupCount: 0, hasData: false }),
    );
    renderPanel();
    expect(await screen.findByText("データがありません")).toBeInTheDocument();
    expect(screen.queryByTestId("trade-chart")).not.toBeInTheDocument();
  });

  it("モックデータのときだけ「モックデータ」と出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok({ mock: true }));
    renderPanel();
    expect(await screen.findByText("モックデータ")).toBeInTheDocument();
  });

  it("実データのときは「モックデータ」を出さない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(screen.queryByText("モックデータ")).not.toBeInTheDocument();
  });

  it("EMAをOFFにしても取り直さず、線だけ消える", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const calls = vi.mocked(apiClient.get).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: /EMA20$/ }));
    await waitFor(() =>
      expect(chartProps.mock.lastCall?.[0].data.emaLines).toHaveLength(0),
    );
    expect(vi.mocked(apiClient.get).mock.calls.length).toBe(calls);
  });

  it("任意の期間のEMAを追加でき、ウォームアップも伸びる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    await userEvent.type(screen.getByLabelText("追加するEMAの期間"), "50");
    await userEvent.click(screen.getByRole("button", { name: "EMAを追加" }));
    expect(screen.getByRole("button", { name: /EMA50$/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(lastUrl().searchParams.get("warmup")).toBe("150"),
    );
  });

  it("不正・重複した期間は追加せず、理由を出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const input = screen.getByLabelText("追加するEMAの期間");
    await userEvent.type(input, "0");
    await userEvent.click(screen.getByRole("button", { name: "EMAを追加" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1〜1000の整数");
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    await userEvent.click(screen.getByRole("button", { name: "EMAを追加" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "EMA20はすでにあります",
    );
  });

  it("「エントリー後の値動き」をOFFにするとエントリーの足より後を隠す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const before = chartProps.mock.lastCall?.[0].data.candles.length;
    await userEvent.click(
      screen.getByRole("checkbox", { name: "エントリー後の値動き" }),
    );
    await waitFor(() =>
      expect(chartProps.mock.lastCall?.[0].data.candles.length).toBeLessThan(
        before,
      ),
    );
  });
});
