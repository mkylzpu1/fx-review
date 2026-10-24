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
    expect(html).toContain("縦軸固定");
    expect(html).toContain("エントリー後の値動き");
    for (const label of ["決済", "決済の種類", "結果"]) {
      expect(html).toContain(`<div class="row after"><dt>${label}</dt>`);
    }
    // エントリー前の情報は隠さない
    expect(html).not.toContain('<div class="row after"><dt>損切り');
  });
});

describe("buildShareHtml: 売買の向き", () => {
  const h1 = (html: string) => html.match(/<h1>.*?<\/h1>/s)?.[0] ?? "";
  const data = (html: string) =>
    JSON.parse(html.split('id="d">')[1].split("</script>")[0]);

  it("買い・売りを見出しに文字で出し、チャートへ渡す色と名前も向きに合わせる", () => {
    const buy = buildShareHtml(input());
    expect(h1(buy)).toContain("▲ 買い");
    expect(data(buy)).toMatchObject({ sideLabel: "買い" });
    const sell = buildShareHtml({
      ...input(),
      trade: { ...trade, side: "sell" } as Trade,
    });
    expect(h1(sell)).toContain("▼ 売り");
    expect(data(sell)).toMatchObject({ sideLabel: "売り" });
    expect(data(sell).colors.sideColor).not.toBe(data(buy).colors.sideColor);
  });
});

describe("buildShareHtml: アプリのチャートと同じ仕様", () => {
  it("凡例・EMA・2画面・全画面・画像保存・縦軸固定の部品を含む", () => {
    const html = buildShareHtml(input());
    for (const w of [
      "エントリー価格",
      "TP（利確）",
      "SL（損切り）",
      "決済価格（勝ち緑・負け赤）",
      "最大含み益・含み損・決済後最大",
      "エントリー以降の背景",
      "IN / OUT の矢印",
      "時間足を並べる",
      "全画面",
      "画像を保存",
      "範囲を合わせ直す",
    ]) {
      expect(html).toContain(w);
    }
  });

  it("決済価格・最大含み益などの水準と勝ち負けを渡す", () => {
    const d = JSON.parse(
      buildShareHtml(
        input({
          trade: { ...trade, mfePips: 40, maePips: -10, afterMaxPips: 5 },
        }),
      )
        .split('id="d">')[1]
        .split("</script>")[0],
    );
    expect(d.exitWin).toBe(true);
    expect(d.excursion).toMatchObject({ mfe: 150.4, mae: 149.9 });
    expect(d.digits).toBe(3);
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
