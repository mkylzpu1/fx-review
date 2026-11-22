import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeading } from "../SectionHeading";

describe("SectionHeading", () => {
  it("先頭の番号を丸バッジに分けて、本文は番号なしで表示する", () => {
    render(<SectionHeading text="1. 勝ちと負けを分けている条件" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(
      screen.getByText("勝ちと負けを分けている条件"),
    ).toBeInTheDocument();
  });

  it("番号が無ければそのまま表示する", () => {
    render(<SectionHeading text="回答の要約" />);
    expect(screen.getByText("回答の要約")).toBeInTheDocument();
  });
});
