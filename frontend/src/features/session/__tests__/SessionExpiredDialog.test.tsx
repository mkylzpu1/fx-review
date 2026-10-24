import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionExpiredDialog } from "../SessionExpiredDialog";
import { useSessionExpiredStore } from "../sessionExpiredStore";
import { peekLoginDraft, registerDraft, resetDraftStore } from "../draftStore";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("aws-amplify/auth", () => ({ signInWithRedirect: signIn }));

describe("ログインの有効期限が切れましたダイアログ", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetDraftStore();
    useSessionExpiredStore.setState({ open: false });
    window.history.pushState({}, "", "/trades/new");
  });

  it("通常は出ない", () => {
    render(<SessionExpiredDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("401の通知で出て、閉じる選択肢（キャンセル）は無い", () => {
    render(<SessionExpiredDialog />);
    act(() => useSessionExpiredStore.getState().notify());
    expect(
      screen.getByText("ログインの有効期限が切れました"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "キャンセル" }),
    ).not.toBeInTheDocument();
  });

  it("「ログインする」で入力を退避してからログインへ進む", async () => {
    registerDraft("trade-form:new", () => ({ entryPrice: "151.200" }));
    render(<SessionExpiredDialog />);
    act(() => useSessionExpiredStore.getState().notify());
    await userEvent.click(screen.getByRole("button", { name: "ログインする" }));
    expect(signIn).toHaveBeenCalledWith({ provider: { custom: "Google" } });
    expect(peekLoginDraft("trade-form:new")).toEqual({ entryPrice: "151.200" });
  });
});
