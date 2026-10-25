import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trade } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn() },
}));
vi.mock("../hooks/usePublishShare", () => {
  class ShareServerUnreachable extends Error {}
  return { publishShare: vi.fn(), ShareServerUnreachable };
});

import { apiClient } from "@/services/apiClient";
import { publishShare, ShareServerUnreachable } from "../hooks/usePublishShare";
import { SharePublishButton } from "../components/SharePublishButton";

const trade = {
  id: "t1",
  pair: "USDJPY",
  side: "buy",
  entryAt: "2026-10-01T01:00:00Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.5,
  exitAt: "2026-10-01T02:00:00Z",
  exitPrice: 150.3,
  exitMethod: "manual",
  pips: 30,
  pnlJpy: 98765,
  rationaleMemo: "押し目を待った",
  slReason: null,
  tpReason: null,
  insight: "秘密の振り返り",
  tags: [{ id: "e", name: "焦り", kind: "emotion" }],
} as unknown as Trade;

const candles = {
  tf: "5m",
  hasData: true,
  warmupCount: 0,
  candles: [{ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 }],
};

const renderIt = () =>
  render(<SharePublishButton trade={trade} pipSize={0.01} settings={null} />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue(candles);
  vi.mocked(publishShare).mockResolvedValue({
    url: "https://share.example.workers.dev/s/abc",
    expiresAt: "2026-10-27T00:00:00.000Z",
  });
});

describe("評価用ファイルの公開ボタン", () => {
  it("「公開してURLを作る」だけがあり、ファイルの書き出し（ダウンロード）は無い", () => {
    renderIt();
    expect(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/書き出/)).not.toBeInTheDocument();
  });

  it("押すと公開し、URL・コピー・開く・期限を画面に出す", async () => {
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    );
    const box = await screen.findByRole("status", { name: "公開したURL" });
    expect(box).toHaveTextContent("24時間後");
    expect(screen.getByRole("textbox", { name: "公開したURL" })).toHaveValue(
      "https://share.example.workers.dev/s/abc",
    );
    expect(screen.getByRole("button", { name: "コピー" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute(
      "href",
      "https://share.example.workers.dev/s/abc",
    );
  });

  it("送るHTMLに、損益額・感情タグ・振り返りは入らない。根拠メモは、チェックを外すと入らない", async () => {
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    );
    await waitFor(() => expect(publishShare).toHaveBeenCalledTimes(1));
    const html = vi.mocked(publishShare).mock.calls[0][0];
    expect(html).toMatch(/^<!doctype html/i);
    expect(html).toContain("押し目を待った");
    for (const secret of ["98765", "98,765", "焦り", "秘密の振り返り"])
      expect(html).not.toContain(secret);

    await userEvent.click(
      screen.getByRole("checkbox", { name: /根拠のタグ・メモ/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    );
    await waitFor(() => expect(publishShare).toHaveBeenCalledTimes(2));
    expect(vi.mocked(publishShare).mock.calls[1][0]).not.toContain(
      "押し目を待った",
    );
  });

  it("サーバーに届かない・失敗したときは、URLの欄を出さない", async () => {
    vi.mocked(publishShare).mockRejectedValueOnce(new ShareServerUnreachable());
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    );
    await waitFor(() => expect(publishShare).toHaveBeenCalled());
    expect(
      screen.queryByRole("status", { name: "公開したURL" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    ).toBeEnabled();
  });

  it("ローソク足が1つも無いときは、公開しない", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ ...candles, candles: [] });
    renderIt();
    await userEvent.click(
      screen.getByRole("button", { name: "公開してURLを作る" }),
    );
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(publishShare).not.toHaveBeenCalled();
  });
});
