import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ImportPage } from "../pages/ImportPage";
import { apiClient } from "@/services/apiClient";
import type { CommitResult, PreviewResult } from "../types";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {},
}));

const SJIS = new Uint8Array([0x83, 0x68, 0x83, 0x8b, 0x2f, 0x89, 0x7e]);

const previewOf = (
  over: Partial<PreviewResult["summary"]> = {},
): PreviewResult => ({
  files: [
    { name: "execution-7.csv", status: "ok", rowCount: 422, message: null },
    {
      name: "other.csv",
      status: "error",
      rowCount: 0,
      message: "約定日時の列がありません",
    },
  ],
  summary: {
    total: 211,
    newCount: 200,
    duplicateCount: 11,
    manualDuplicateCount: 0,
    completesOpenCount: 0,
    openCount: 0,
    errorCount: 1,
    overlappedRows: 0,
    ...over,
  },
  trades: [
    {
      sourceKey: "rakuten:1000:1001",
      importStatus: "new",
      entryNo: "1000",
      exitNo: "1001",
      pair: "USDJPY",
      side: "buy",
      lots: 0.1,
      entryAt: "2026-10-01T13:10:00Z",
      entryPrice: 150.1,
      exitAt: "2026-10-01T13:30:00Z",
      exitPrice: 150.2,
      pnlJpy: 1000,
      status: "closed",
    },
  ],
  errors: [
    {
      file: "execution-7.csv",
      line: 12,
      executionNo: "1234",
      message: "対応する新規がありません",
    },
  ],
  entryRange: { from: "2026-10-01T13:10:00Z", to: "2026-10-23T06:21:00Z" },
});

const committed: CommitResult = {
  imported: 200,
  skipped: 11,
  overwritten: 0,
  completedOpen: 0,
  manualSkipped: 0,
  errorCount: 1,
  files: [],
  entryRange: { from: "2026-10-01T13:10:00Z", to: "2026-10-23T06:21:00Z" },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ImportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function chooseFile() {
  const file = new File([SJIS], "execution-7.csv", { type: "text/csv" });
  await userEvent.upload(screen.getByLabelText("CSVファイル"), file);
  await userEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
}

describe("CSV取り込み", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ファイルを選ぶまで「内容を確認する」は押せず、MT5・その他は準備中", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: "内容を確認する" }),
    ).toBeDisabled();
    expect(screen.getByRole("radio", { name: /MT5/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /その他/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "楽天FX証券" })).toBeChecked();
  });

  it("Shift_JISをデコードしてプレビューに送り、件数・エラー行・別形式のファイルを出す", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(previewOf());
    renderPage();
    await chooseFile();

    expect(await screen.findByText("取り込み内容")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/imports/preview", {
      files: [{ name: "execution-7.csv", text: "ドル/円" }],
    });
    expect(screen.getByText("200件")).toBeInTheDocument();
    expect(screen.getByText(/約定日時の列がありません/)).toBeInTheDocument();
    expect(screen.getByText(/12行目/)).toBeInTheDocument();
    expect(screen.getByText("新規")).toBeInTheDocument();
  });

  it("重複がある時だけ扱いを選べ、既定は除いて取り込む。選んだ値でcommitする", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(previewOf());
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");

    expect(screen.getByRole("radio", { name: /除いて取り込む/ })).toBeChecked();
    await userEvent.click(
      screen.getByRole("radio", { name: /CSVの値で上書きする/ }),
    );

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      ...committed,
      skipped: 0,
      overwritten: 11,
    });
    await userEvent.click(screen.getByRole("button", { name: "取り込む" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenLastCalledWith("/imports/commit", {
        files: [{ name: "execution-7.csv", text: "ドル/円" }],
        duplicateMode: "overwrite",
      }),
    );
  });

  it("手入力と重複する取引があれば、件数と「保存しない」説明を出す。無ければ出さない", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(
      previewOf({ manualDuplicateCount: 3, newCount: 197 }),
    );
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");
    expect(screen.getByText("手入力と重複")).toBeInTheDocument();
    expect(screen.getByText("3件")).toBeInTheDocument();
    expect(
      screen.getByText(/手入力したトレードと同じ取引.*保存しません/),
    ).toBeInTheDocument();
  });

  it("手入力と重複する取引が無ければ、その件数の表示は出さない", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(previewOf());
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");
    expect(screen.queryByText("手入力と重複")).toBeNull();
  });

  it("完了後、手入力と同じ取引のため保存しなかった件数を出す", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(previewOf());
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      ...committed,
      manualSkipped: 2,
    });
    await userEvent.click(screen.getByRole("button", { name: "取り込む" }));
    expect(await screen.findByText("取り込みました")).toBeInTheDocument();
    expect(
      screen.getByText(/手入力と同じ取引のため保存しない/),
    ).toHaveTextContent("2件");
  });

  it("重複が無ければ扱いの選択は出さない", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(
      previewOf({ duplicateCount: 0 }),
    );
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");
    expect(screen.queryByText("取り込み済みの扱い")).toBeNull();
  });

  it("完了後に、結果・同期コマンド・未入力キューへのリンクを出す", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(previewOf());
    renderPage();
    await chooseFile();
    await screen.findByText("取り込み内容");

    vi.mocked(apiClient.post).mockResolvedValueOnce(committed);
    await userEvent.click(screen.getByRole("button", { name: "取り込む" }));

    expect(await screen.findByText("取り込みました")).toBeInTheDocument();
    expect(
      screen.getByText(
        "npm run candles:sync -- --from 2026-10-01 --to 2026-10-23",
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "入力を続ける" });
    expect(link).toHaveAttribute("href", "/trades/queue");
  });

  it("取り込める行が0件なら「取り込む」を押せない", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      ...previewOf({ total: 0, newCount: 0, duplicateCount: 0, errorCount: 0 }),
      trades: [],
      errors: [],
    });
    renderPage();
    await chooseFile();
    await screen.findByText(/取り込めるトレードがありません/);
    expect(screen.getByRole("button", { name: "取り込む" })).toBeDisabled();
  });

  it("プレビューに失敗したら、直し方つきのエラーを出す", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("x"));
    renderPage();
    await chooseFile();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "選んだファイルは残っています",
    );
  });
});
