import "@testing-library/jest-dom";
import { forwardRef, useImperativeHandle } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { useChartUiStore } from "../chartUiStore";
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
const refit = vi.fn();
vi.mock("../components/TradeChart", () => ({
  TradeChart: forwardRef(function MockChart(
    p: {
      data: { candles: unknown[]; emaLines: unknown[] };
      overlays?: Record<string, boolean>;
      resetKey?: string;
      fill?: boolean;
    },
    ref,
  ) {
    chartProps(p);
    useImperativeHandle(ref, () => ({ screenshot: () => null, refitY: refit }));
    return <div data-testid="trade-chart" />;
  }),
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
    localStorage.clear();
    useChartUiStore.setState({ fullscreen: false });
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

  it("設定の本数が少なくても、初期表示に必要な本数（前60本・後40本）は読み込む", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel(); // 設定は前40本・後20本
    await screen.findByTestId("trade-chart");
    const u = lastUrl();
    const hours = (iso: string) => Date.parse(iso) / 3_600_000;
    expect(hours(trade.entryAt) - hours(u.searchParams.get("from")!)).toBe(60);
    expect(hours(u.searchParams.get("to")!) - hours(trade.exitAt!)).toBe(40);
  });

  it("凡例で、線や矢印の表示・非表示を切り替えられる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const last = () =>
      chartProps.mock.calls[chartProps.mock.calls.length - 1][0];
    expect(last().overlays.slLine).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /SL（損切り）/ }));
    expect(last().overlays.slLine).toBe(false);
    expect(
      screen.getByRole("button", { name: /SL（損切り）/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("EMAを追加しても、チャートの位置を戻す合図（resetKey）は変わらない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const keyOf = () =>
      chartProps.mock.calls[chartProps.mock.calls.length - 1][0].resetKey;
    const before = keyOf();
    await userEvent.type(screen.getByRole("spinbutton"), "50");
    await userEvent.click(screen.getByRole("button", { name: /追加/ }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /EMA50/ })[0],
      ).toBeInTheDocument(),
    );
    expect(keyOf()).toBe(before);
  });

  it("「エントリー後の値動き」を切り替えても、チャートの位置を戻す合図は変わらない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const keyOf = () =>
      chartProps.mock.calls[chartProps.mock.calls.length - 1][0].resetKey;
    const before = keyOf();
    await userEvent.click(screen.getByLabelText("エントリー後の値動き"));
    expect(keyOf()).toBe(before);
  });

  it("全画面に切り替えられ、Escで閉じる。チャートは作り直さず広げるだけ", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const fillOf = () =>
      chartProps.mock.calls[chartProps.mock.calls.length - 1][0].fill;
    expect(fillOf()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "全画面" }));
    expect(fillOf()).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(fillOf()).toBe(false));
  });

  const lastProps = () =>
    chartProps.mock.calls[chartProps.mock.calls.length - 1][0];

  it("表示設定（時間足）を覚えて、次に開いたときも引き継ぐ。初期値に戻せる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    const first = renderPanel();
    await screen.findByTestId("trade-chart");
    expect(screen.queryByText("設定の初期値に戻す")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "15m" }));
    expect(screen.getByText("設定の初期値に戻す")).toBeInTheDocument();
    first.unmount();

    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(screen.getByRole("radio", { name: "15m" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByText("設定の初期値に戻す"));
    expect(screen.getByRole("radio", { name: "1h" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("EMA・凡例・縦軸固定も覚える", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    const first = renderPanel();
    await screen.findByTestId("trade-chart");
    await userEvent.click(screen.getByRole("button", { name: /SL（損切り）/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "縦軸固定" }));
    await userEvent.click(screen.getByRole("button", { name: /EMA20$/ }));
    first.unmount();

    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(lastProps().overlays.slLine).toBe(false);
    expect(lastProps().autoScaleY).toBe(false);
    expect(screen.getByRole("checkbox", { name: "縦軸固定" })).toBeChecked();
    expect(lastProps().data.emaLines).toHaveLength(0);
  });

  it("壊れた保存内容は無視して、設定の初期値で開く", async () => {
    localStorage.setItem("fxr.chartPrefs.v1", "{not json");
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(screen.getByRole("radio", { name: "1h" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("縦軸を固定している間は状態を示し、範囲を合わせ直せる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(screen.queryByText("縦軸を固定中")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "縦軸固定" }));
    expect(screen.getByText("縦軸を固定中")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "範囲を合わせ直す" }),
    );
    expect(refit).toHaveBeenCalledTimes(1);
  });

  it("価格軸を直接動かして自動追従が切れたら、チェックも固定中に合わせる", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(
      screen.getByRole("checkbox", { name: "縦軸固定" }),
    ).not.toBeChecked();
    act(() => lastProps().onAutoScaleChange(false));
    expect(screen.getByRole("checkbox", { name: "縦軸固定" })).toBeChecked();
    expect(screen.getByText("縦軸を固定中")).toBeInTheDocument();
    // ダブルクリックなどで自動追従に戻ったときも合わせる
    act(() => lastProps().onAutoScaleChange(true));
    expect(
      screen.getByRole("checkbox", { name: "縦軸固定" }),
    ).not.toBeChecked();
  });

  it("「時間足を並べる」で2枚のチャートを出し、2枚目は別の時間足で取得する", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    await userEvent.click(
      screen.getByRole("button", { name: "時間足を並べる" }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("trade-chart")).toHaveLength(2),
    );
    const second = screen.getByRole("radiogroup", { name: "時間足（画面2）" });
    // 1画面目が1hなので、2画面目は1つ大きい4h
    expect(within(second).getByRole("radio", { name: "4h" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const tfs = vi
      .mocked(apiClient.get)
      .mock.calls.map((c) =>
        new URL(c[0] as string, "http://x").searchParams.get("tf"),
      );
    expect(tfs).toContain("4h");

    await userEvent.click(within(second).getByRole("radio", { name: "15m" }));
    await waitFor(() => expect(lastUrl().searchParams.get("tf")).toBe("15m"));
    await userEvent.click(screen.getByRole("button", { name: "1画面に戻す" }));
    expect(screen.getAllByTestId("trade-chart")).toHaveLength(1);
  });

  it("キーボード: Fで全画面、数字キーで時間足、Dで2画面", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");

    await userEvent.keyboard("3");
    await waitFor(() => expect(lastUrl().searchParams.get("tf")).toBe("15m"));

    await userEvent.keyboard("f");
    await waitFor(() => expect(lastProps().fill).toBe(true));
    await userEvent.keyboard("f");
    await waitFor(() => expect(lastProps().fill).toBe(false));

    await userEvent.keyboard("d");
    await waitFor(() =>
      expect(screen.getAllByTestId("trade-chart")).toHaveLength(2),
    );
  });

  it("「エントリー後の値動き」を切ると、決済・最大含み益などの線を出さない（凡例にも出さない）", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(lastProps().overlays.exitLine).toBe(true);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "エントリー後の値動き" }),
    );
    await waitFor(() => {
      expect(lastProps().overlays.exitLine).toBe(false);
      expect(lastProps().overlays.excursion).toBe(false);
    });
    expect(
      screen.queryByRole("button", { name: /決済価格/ }),
    ).not.toBeInTheDocument();
  });

  it("2画面のとき、時間足の切り替えは各画面の見出しの横に並び、上の1つは出さない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    expect(
      screen.getByRole("radiogroup", { name: "時間足" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "時間足を並べる" }),
    );
    expect(
      screen.queryByRole("radiogroup", { name: "時間足" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "時間足（画面1）" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "時間足（画面2）" }),
    ).toBeInTheDocument();
  });

  it("キーボード: Aでエントリー後の値動きを切り替える", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    const box = screen.getByRole("checkbox", { name: "エントリー後の値動き" });
    expect(box).toBeChecked();
    await userEvent.keyboard("a");
    await waitFor(() => expect(box).not.toBeChecked());
    await userEvent.keyboard("a");
    await waitFor(() => expect(box).toBeChecked());
  });

  it("入力欄に文字を打っている間は、ショートカットを効かせない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    renderPanel();
    await screen.findByTestId("trade-chart");
    await userEvent.type(screen.getByLabelText("追加するEMAの期間"), "3f");
    expect(lastProps().fill).toBe(false);
    expect(screen.getByRole("radio", { name: "1h" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("最大含み益・含み損の値があるトレードだけ、凡例にその切り替えを出す", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(ok());
    const { unmount } = renderPanel();
    await screen.findByTestId("trade-chart");
    expect(
      screen.queryByRole("button", { name: /最大含み益・含み損/ }),
    ).not.toBeInTheDocument();
    unmount();

    const withExcursion = {
      ...trade,
      exitPrice: 150.3,
      mfePips: 40,
      maePips: -10,
      afterMaxPips: 5,
    } as unknown as Trade;
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <ChartPanel trade={withExcursion} pipSize={0.01} settings={settings} />
      </QueryClientProvider>,
    );
    await screen.findByTestId("trade-chart");
    // 買い: エントリー150の+40pips=150.4 / -10pips=149.9 / 決済150.3の+5pips=150.35
    expect(lastProps().excursion).toEqual({
      mfe: 150.4,
      mae: 149.9,
      afterMax: 150.35,
    });
    expect(lastProps().overlays.excursion).toBe(false);
    await userEvent.click(
      screen.getByRole("button", { name: /最大含み益・含み損・決済後最大/ }),
    );
    expect(lastProps().overlays.excursion).toBe(true);
  });
});
