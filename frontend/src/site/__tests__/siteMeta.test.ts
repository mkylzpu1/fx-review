import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  path.resolve(__dirname, "../../../site.html"),
  "utf8",
);

/** <meta property|name="key" content="..."> の content を取り出す */
function meta(key: string): string | undefined {
  const re = new RegExp(
    `<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`,
    "s",
  );
  return re.exec(html)?.[1];
}

describe("公開サイト（GitHub Pages）のカード表示用メタタグ", () => {
  it("題名・説明・サイト名がある", () => {
    expect(meta("og:title")).toContain("とれみる");
    expect(meta("og:description")?.length).toBeGreaterThan(20);
    expect(meta("og:site_name")).toBe("とれみる");
    expect(meta("description")).toBe(meta("og:description"));
  });

  it("画像は絶対URLになる前提の __SITE_URL__ で、サイズと代替テキストを持つ", () => {
    expect(meta("og:image")).toBe("__SITE_URL__/og-lp.png");
    expect(meta("og:url")).toBe("__SITE_URL__/");
    expect(meta("og:image:width")).toBe("1200");
    expect(meta("og:image:height")).toBe("630");
    expect(meta("og:image:alt")).toBeTruthy();
  });

  it("X（Twitter）は大きい画像のカードにする", () => {
    expect(meta("twitter:card")).toBe("summary_large_image");
    expect(meta("twitter:image")).toBe("__SITE_URL__/og-lp.png");
    expect(meta("twitter:title")).toBe(meta("og:title"));
  });
});
