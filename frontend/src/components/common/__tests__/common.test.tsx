import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldError } from "../FieldError";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../ConfirmDialog";

describe("FieldError", () => {
  it("メッセージがあるときだけ表示する", () => {
    const { rerender } = render(
      <FieldError message="買いのSLはエントリーより低く設定してください" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("買いのSL");
    rerender(<FieldError />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("タイトルと説明を表示する", () => {
    render(
      <EmptyState
        title="まだトレードがありません"
        description="CSVを取り込むか記録してください"
      />,
    );
    expect(screen.getByText("まだトレードがありません")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("キャンセルに初期フォーカスが当たり、確認で onConfirm が呼ばれる", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="削除しますか"
        confirmLabel="削除"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
