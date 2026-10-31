import { describe, expect, it } from "vitest";
import { buildDayBundles, buildManifest } from "../buildDayJson";
import {
  BLOG_REPO,
  INSTRUCTIONS_FILE,
  buildInstructions,
} from "../buildInstructions";
import { makeTrade } from "./fixtures";

const make = (from: string, to: string, entryAt: string, memo = "根拠あり") => {
  const o = {
    timeZone: "Asia/Tokyo",
    from,
    to,
    includeOpen: false,
  };
  const built = buildDayBundles(
    [makeTrade({ entryAt, rationaleMemo: memo })],
    o,
  );
  const manifest = buildManifest(built, {
    ...o,
    generatedAt: new Date("2026-11-01T00:00:00Z"),
  });
  return buildInstructions({
    manifest,
    days: built.days,
    zipFileName: `tremiru-blog_${from}_${to}.zip`,
  });
};

describe("buildInstructions", () => {
  const week = make("2026-10-26", "2026-11-01", "2026-10-28T01:00:00Z");

  it("1週間=1記事、投稿先、zip名、置き場所、取り込みコマンドが入る", () => {
    expect(INSTRUCTIONS_FILE).toBe("00_READ_ME_FIRST.md");
    expect(week).toContain("1週間のトレード = 1記事");
    expect(week).toContain(BLOG_REPO);
    expect(week).toContain("tremiru-blog_2026-10-26_2026-11-01.zip");
    expect(week).toContain("src/content/weeks/2026-10-26.json");
    expect(week).toContain("src/data/days/<日付>.json");
    expect(week).toContain(
      "node scripts/import-bundle.mjs tremiru-blog_2026-10-26_2026-11-01.zip --publish-date 2026-11-02",
    );
    expect(week).toContain("week/2026-10-26");
    expect(week).toContain("docs/article-guidelines.md");
  });
  it("月〜日の1週間なら、期間の注意は出ない", () => {
    expect(week).not.toContain("1週間ではありません");
  });
  it("週でない期間では、確認を促す注意が出る", () => {
    const odd = make("2026-10-28", "2026-10-29", "2026-10-28T01:00:00Z");
    expect(odd).toContain("1週間ではありません");
    expect(odd).toContain("2日間");
  });
  it("メモ未入力の警告が一覧に入り、警告が無ければ「なし」", () => {
    const warn = make("2026-10-26", "2026-11-01", "2026-10-28T01:00:00Z", "");
    expect(warn).toContain("2026-10-28 #1 【根拠メモ未入力】");
    expect(week).toMatch(/## メモ未入力・警告の一覧[\s\S]*- なし/);
  });
  it("メモが無い項目を創作しない、数字を書かないルールを含む", () => {
    expect(week).toContain("創作しない");
    expect(week).toContain("数字");
    expect(week).not.toMatch(/github_pat_|ghp_/);
  });
});
