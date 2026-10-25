import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FirstVisitGuideDialog } from "../components/FirstVisitGuideDialog";

const TITLE = "はじめに、ご利用ガイドで初期設定を終わらせてください";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FirstVisitGuideDialog />
      <Routes>
        <Route path="/guide" element={<p>ガイドのページ</p>} />
        <Route path="*" element={<p>ほかのページ</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("初回のご利用ガイド案内", () => {
  beforeEach(() => window.localStorage.clear());

  it("はじめて開いたときに表示する", () => {
    renderAt("/stats");
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it("「ご利用ガイドを開く」でガイドへ移動し、次から出さない", () => {
    const { unmount } = renderAt("/stats");
    fireEvent.click(screen.getByRole("button", { name: "ご利用ガイドを開く" }));
    expect(screen.getByText("ガイドのページ")).toBeInTheDocument();
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    unmount();
    renderAt("/stats");
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("「あとで見る」で閉じ、次から出さない", () => {
    const { unmount } = renderAt("/stats");
    fireEvent.click(screen.getByRole("button", { name: "あとで見る" }));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    unmount();
    renderAt("/stats");
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it("ガイドのページ自体では出さない", () => {
    renderAt("/guide");
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });
});
