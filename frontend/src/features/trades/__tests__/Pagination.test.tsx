import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination, pageWindow } from "../components/Pagination";

describe("pageWindow", () => {
  it("開いているページの前後2ページを返す", () => {
    expect(pageWindow(10, 20)).toEqual([8, 9, 10, 11, 12]);
  });
  it("先頭・末尾では範囲内だけにする", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3]);
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(20, 20)).toEqual([18, 19, 20]);
  });
});

describe("Pagination", () => {
  const setup = (page = 5, total = 200) => {
    const onChange = vi.fn();
    render(
      <Pagination page={page} limit={20} total={total} onChange={onChange} />,
    );
    return onChange;
  };

  it("1ページ以下なら何も出さない", () => {
    const { container } = render(
      <Pagination page={1} limit={20} total={20} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("前後2ページの番号を出し、クリックでそのページへ移る", async () => {
    const onChange = setup(5);
    for (const n of [3, 4, 5, 6, 7])
      expect(
        screen.getByRole("button", { name: `${n}ページ目` }),
      ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "2ページ目" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5ページ目" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(screen.getByRole("button", { name: "7ページ目" }));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("ページ番号を入力して移動できる（Enterでも可）", async () => {
    const onChange = setup(1);
    const input = screen.getByRole("spinbutton", {
      name: "移動するページ番号",
    });
    await userEvent.type(input, "8");
    await userEvent.click(screen.getByRole("button", { name: "移動" }));
    expect(onChange).toHaveBeenLastCalledWith(8);
    await userEvent.type(input, "6{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it("範囲外の番号は1〜最終ページに丸め、空のときは移動しない", async () => {
    const onChange = setup(3, 200); // 最終は10ページ
    const input = screen.getByRole("spinbutton", {
      name: "移動するページ番号",
    });
    await userEvent.type(input, "99{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(10);
    await userEvent.type(input, "0{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(1);
    onChange.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "移動" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
