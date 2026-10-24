import "@testing-library/jest-dom";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "../AppLayout";

vi.mock("@/features/auth/components/AuthProvider", () => ({
  useAuthContext: () => ({
    user: { name: "T", email: "t@e.com", userId: "u" },
  }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function renderIt(path = "/trades/new") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout>
        <p>中身</p>
      </AppLayout>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  afterEach(() => setOnline(true));

  it("オンラインのときはオフラインバナーを出さない", () => {
    renderIt();
    expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument();
  });

  it("オフラインになるとバナーを出し、戻ると消す", () => {
    renderIt();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("オフラインです");
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument();
  });

  it("最初からオフラインでもバナーを出す", () => {
    setOnline(false);
    renderIt();
    expect(screen.getByText(/オフラインです/)).toBeInTheDocument();
  });

  it("記録画面ではナビの「トレード」が現在地になる", () => {
    renderIt("/trades/new");
    const nav = screen.getByRole("navigation", { name: "メイン" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent(
      "トレード",
    );
  });
});
