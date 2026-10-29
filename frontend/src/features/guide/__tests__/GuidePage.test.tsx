import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GuidePage } from "../pages/GuidePage";

function renderIt() {
  return render(
    <MemoryRouter>
      <GuidePage />
    </MemoryRouter>,
  );
}

describe("ご利用ガイド", () => {
  beforeEach(() => window.localStorage.clear());

  it("セットアップ・使い方・ローソク足の更新の3セクションがある", () => {
    renderIt();
    expect(
      screen.getByRole("heading", { name: "セットアップ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "使い方" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ローソク足の更新が必要です" }),
    ).toBeInTheDocument();
  });

  it("MT5・Cloudflare・ローカル起動のみであることを説明する", () => {
    renderIt();
    expect(
      screen.getByRole("heading", { name: "B. MT5を設定する" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /C\. Cloudflareを設定する/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("このアプリは、自分のパソコンの中だけで動かします"),
    ).toBeInTheDocument();
  });

  it("「できた」を押すと進み具合が増え、覚えておく", () => {
    const { unmount } = renderIt();
    const setup = screen.getByRole("region", { name: /セットアップ/ });
    expect(within(setup).getByText("0 / 9 完了")).toBeInTheDocument();
    fireEvent.click(
      within(setup).getAllByRole("button", { name: "できた" })[0],
    );
    expect(within(setup).getByText("1 / 9 完了")).toBeInTheDocument();
    unmount();
    renderIt();
    expect(
      within(screen.getByRole("region", { name: /セットアップ/ })).getByText(
        "1 / 9 完了",
      ),
    ).toBeInTheDocument();
  });

  it("セットアップに、アプリをクローンする手順がある", () => {
    renderIt();
    expect(
      screen.getByRole("heading", {
        name: /アプリをパソコンにダウンロードする/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("git clone https://github.com/mkylzpu1/fx-review.git"),
    ).toBeInTheDocument();
  });

  it("目次から各セクションへ飛べる", () => {
    renderIt();
    const toc = screen.getByRole("navigation", { name: "ガイドの目次" });
    expect(toc.querySelectorAll('a[href^="#"]')).toHaveLength(3);
    expect(document.getElementById("candles")).not.toBeNull();
  });
});
