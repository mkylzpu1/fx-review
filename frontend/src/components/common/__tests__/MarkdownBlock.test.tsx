import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownBlock } from "../MarkdownBlock";

describe("MarkdownBlock", () => {
  it("1行まるごと太字の段落は、見出しのように左に区切り線を付けて浮き立たせる", () => {
    const { container } = render(
      <MarkdownBlock>{"**①感情・根拠が記録されたトレードは、成績が分かれている（仮説、n≒20）**"}</MarkdownBlock>,
    );
    const p = container.querySelector("p");
    expect(p).toHaveClass("bg-surface");
    expect(p).toHaveTextContent("①感情・根拠が記録されたトレードは、成績が分かれている");
  });

  it("「仮説」を含む注記はバッジとして分離する", () => {
    render(<MarkdownBlock>{"**SLが浅い（仮説, n=5）**"}</MarkdownBlock>);
    expect(screen.getByText("仮説, n=5")).toBeInTheDocument();
  });

  it("通常の段落は見出し扱いしない", () => {
    const { container } = render(
      <MarkdownBlock>{"これは普通の説明文です。"}</MarkdownBlock>,
    );
    const p = container.querySelector("p");
    expect(p).not.toHaveClass("bg-surface");
  });

  it("### の小見出しも背景を敷いたチップ風にする", () => {
    const { container } = render(
      <MarkdownBlock>{"### ①勝ちパターン（仮説, n=5）"}</MarkdownBlock>,
    );
    expect(container.querySelector("h4")).toHaveClass("bg-surface");
  });

  it("表はそのままテーブルとして描画する", () => {
    render(
      <MarkdownBlock>
        {["| 項目 | 値 |", "|---|---|", "| 勝率 | 38.6% |"].join("\n")}
      </MarkdownBlock>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("38.6%")).toBeInTheDocument();
  });
});
