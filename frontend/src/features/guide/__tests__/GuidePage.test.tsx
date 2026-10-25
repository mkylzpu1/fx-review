import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("セットアップ・使い方・ローソク足の更新の3セクションがある", () => {
    renderIt();
    expect(
      screen.getByRole("heading", { name: "1. セットアップ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. 使い方" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "3. ローソク足の更新が必要です" }),
    ).toBeInTheDocument();
  });

  it("MT5・Cloudflare・ローカル起動のみであることを説明する", () => {
    renderIt();
    expect(
      screen.getByRole("heading", { name: /1-2\. MT5を設定する/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /1-3\. Cloudflareを設定する/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("このアプリは、手元のPCでだけ動かします"),
    ).toBeInTheDocument();
  });

  it("目次から各セクションへ飛べる", () => {
    renderIt();
    const toc = screen.getByRole("navigation", { name: "ガイドの目次" });
    expect(toc.querySelectorAll("a")).toHaveLength(3);
    expect(document.getElementById("candles")).not.toBeNull();
  });
});
