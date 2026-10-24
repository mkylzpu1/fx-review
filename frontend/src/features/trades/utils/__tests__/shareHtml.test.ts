import { describe, expect, it } from "vitest";
import type { Trade } from "../../types";
import { buildShareHtml, escapeHtml, safeJson } from "../shareHtml";

const trade = {
  pair: "USDJPY",
  side: "buy",
  entryAt: "2026-10-01T01:00:00Z",
  entryPrice: 150,
  slPrice: 149.8,
  tpPrice: 150.5,
  exitAt: "2026-10-01T02:00:00Z",
  exitPrice: 150.3,
  exitMethod: "manual",
  pips: 30,
  pnlJpy: 98765,
  insight: "秘密の振り返り",
  nextRule: "秘密の次のルール",
  rationaleMemo: "押し目</script><b>",
  slReason: "直近安値の下",
  tpReason: null,
  tags: [
    { id: "1", name: "押し目買い", kind: "rationale" },
    { id: "2", name: "焦り", kind: "emotion" },
  ],
} as unknown as Trade;

const input = (over = {}) => ({
  trade,
  pipSize: 0.01,
  frames: [
    {
      tf: "5m" as const,
      warmupCount: 1,
      candles: [
        { time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
        { time: 1300, open: 1.5, high: 2, low: 1, close: 1.8 },
      ],
    },
  ],
  emas: [{ period: 20, visible: true }],
  includeReasons: true,
  defaultTf: "5m" as const,
  librarySource: "/*lib*/",
  ...over,
});

describe("buildShareHtml", () => {
  it("損益額・感情タグ・振り返りの記述を含めない", () => {
    const html = buildShareHtml(input());
    expect(html).not.toContain("98765");
    expect(html).not.toContain("98,765");
    expect(html).not.toContain("焦り");
    expect(html).not.toContain("秘密の振り返り");
    expect(html).not.toContain("秘密の次のルール");
  });

  it("根拠のタグ・メモ・理由は、含める指定のときだけ入れる", () => {
    const on = buildShareHtml(input());
    expect(on).toContain("押し目買い");
    expect(on).toContain("直近安値の下");
    const off = buildShareHtml(input({ includeReasons: false }));
    expect(off).not.toContain("押し目買い");
    expect(off).not.toContain("直近安値の下");
  });

  it("メモ内のHTMLは無害化し、データ内の </script> でページが壊れない", () => {
    const html = buildShareHtml(input());
    expect(html).toContain("押し目&lt;/script&gt;&lt;b&gt;");
    const data = html.split('id="d">')[1].split("</script>")[0];
    expect(data).not.toContain("<");
    expect(JSON.parse(data).frames[0].c).toHaveLength(2);
  });

  it("価格・時刻は日本時間で表示する", () => {
    const html = buildShareHtml(input());
    expect(html).toContain("2026/10/01 10:00");
    expect(html).toContain("150.000");
  });
});

describe("buildShareHtml: エントリー後・縦軸固定", () => {
  it("決済・結果の行は隠す指定（after）になり、チェックボックスで表示できる", () => {
    const html = buildShareHtml(input());
    expect(html).toContain("body:not(.show-after) .after{display:none}");
    expect(html).toContain('id="showAfter"');
    expect(html).toContain('id="fixY"');
    for (const label of ["決済", "決済の種類", "結果"]) {
      expect(html).toContain(`<div class="row after"><dt>${label}</dt>`);
    }
    // エントリー前の情報は隠さない
    expect(html).not.toContain('<div class="row after"><dt>損切り');
  });
});

describe("escape", () => {
  it("escapeHtml / safeJson", () => {
    expect(escapeHtml('<a href="x">&')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;",
    );
    expect(safeJson({ a: "</script>" })).not.toContain("<");
  });
});
