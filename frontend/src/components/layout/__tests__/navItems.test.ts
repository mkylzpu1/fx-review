import { describe, it, expect } from "vitest";
import { NAV_ITEMS, isCurrent } from "../navItems";

const current = (path: string) =>
  NAV_ITEMS.filter((i) => isCurrent(i, path)).map((i) => i.label);

describe("統一ナビの現在地", () => {
  it.each([
    ["/trades", "トレード"],
    ["/trades/abc/edit", "トレード"],
    ["/trades/queue", "トレード"],
    ["/trades/import", "トレード"],
    ["/stats/weekly", "統計"],
    ["/rules/xyz", "ルール"],
    ["/notes/1", "学習メモ"],
    ["/settings", "設定"],
  ])("%s は「%s」を選択状態にする", (path, label) => {
    expect(current(path)).toEqual([label]);
  });

  it("アカウントや404はどの項目も選択しない", () => {
    expect(current("/account")).toEqual([]);
    expect(current("/tradesx")).toEqual([]);
  });
});
