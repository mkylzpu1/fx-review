import { describe, it, expect } from "vitest";
import {
  buildExport,
  type ExportInput,
} from "../../../src/services/export/exportBuilder";
import {
  csvCell,
  DEFAULT_INCLUDE,
} from "../../../src/services/export/exportColumns";
import type { Rule, TradeView } from "../../../src/types/trade";

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: "r1",
  title: "SLを必ず入れる",
  description: "",
  isActive: true,
  sortOrder: 0,
  autoKey: "sl_set",
  validationTargetN: 10,
  validationStartedAt: null,
  ...over,
});

function trade(over: Partial<TradeView> = {}): TradeView {
  return {
    id: "t1",
    pair: "USDJPY",
    side: "buy",
    lots: 0.1,
    entryAt: "2026-10-19T00:00:00Z", // 月 09:00 JST（東京）
    entryPrice: 150.1,
    slPrice: null,
    tpPrice: null,
    slReason: null,
    tpReason: null,
    rationaleMemo: null,
    confidence: null,
    exitAt: "2026-10-19T00:30:00Z",
    exitPrice: 150.2,
    exitMethod: "manual",
    pnlJpy: 1000,
    insight: null,
    nextRule: null,
    status: "closed",
    mfePips: null,
    maePips: null,
    afterMaxPips: null,
    tags: [],
    ruleChecks: [],
    pips: 10,
    rMultiple: null,
    plannedRr: null,
    riskJpy: null,
    riskPct: null,
    holdMinutes: 30,
    ruleResults: [],
    deviation: false,
    isUnfilled: true,
    missing: ["sl", "tp", "rationale"],
    source: "rakuten_csv",
    ...over,
  } as TradeView;
}

const input = (over: Partial<ExportInput> = {}): ExportInput => ({
  views: [trade()],
  rules: [rule()],
  maxRiskPct: 1,
  minRr: 2,
  timezone: "Asia/Tokyo",
  format: "markdown",
  include: DEFAULT_INCLUDE,
  now: new Date("2026-10-24T03:00:00Z"),
  ...over,
});

describe("csvCell", () => {
  it("カンマ・引用符・改行は引用符で囲む", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("数値と null: マイナスの数値はそのまま、null は空欄", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });
  it("自由記述の先頭が式になる文字なら無害化する（数値は対象外）", () => {
    expect(csvCell("=SUM(A1)", true)).toBe("'=SUM(A1)");
    expect(csvCell("-1pipで損切り", true)).toBe("'-1pipで損切り");
    expect(csvCell("普通のメモ", true)).toBe("普通のメモ");
  });
});

describe("Markdown", () => {
  const md = buildExport(input()).content;

  it("依頼文・ルール・集計・一覧・分析の依頼がそろう", () => {
    expect(md).toContain("# FXトレード振り返り分析の依頼");
    expect(md).toContain("## 1. 私のルール（計画）");
    expect(md).toContain("- SLを必ず入れる");
    expect(md).toContain("口座の 1%");
    expect(md).toContain("## 2. 集計サマリー");
    expect(md).toContain("## 3. トレード一覧 (CSV)");
    expect(md).toContain("## 4. 分析してほしいこと");
    expect(md).toContain("3. 次の2週間で守る改善ルール3つ（具体的な数値つき）");
  });

  it("入力の少なさを冒頭の集計に書く", () => {
    expect(md).toContain("SL入力あり 0件 / 全 1件");
    expect(md).toContain("根拠タグあり 0件");
    expect(md).toContain("R未計算 1件");
  });

  it("日時はJST、曜日とセッションは表示タイムゾーンで出す", () => {
    expect(md).toContain("2026-10-19 09:00");
    expect(md).toContain(",月,東京");
  });

  it("無効なルールは載せない", () => {
    const out = buildExport(
      input({ rules: [rule({ title: "古いルール", isActive: false })] }),
    ).content;
    expect(out).not.toContain("古いルール");
    expect(out).toContain("有効なルールはありません");
  });
});

describe("CSV / JSON", () => {
  it("includeがOFFのグループの列は出さない。基本の列は残る", () => {
    const csv = buildExport(
      input({
        format: "csv",
        include: {
          ...DEFAULT_INCLUDE,
          planDiff: false,
          reflection: false,
          market: false,
        },
      }),
    ).content;
    const header = csv.split("\n")[0];
    expect(header).toBe(
      "id,日時JST,通貨ペア,方向,エントリー,決済価格,決済方法,pips,R,ロット,損益円,保有分,MFE_pips,MAE_pips,決済後最大到達_pips,根拠タグ,根拠メモ,ルール逸脱",
    );
  });

  it("未入力は空欄、複数タグは | 区切り", () => {
    const csv = buildExport(
      input({
        format: "csv",
        views: [
          trade({
            tags: [
              { id: "a", name: "押し目買い", kind: "rationale" },
              { id: "b", name: "ブレイク", kind: "rationale" },
            ],
          }),
        ],
      }),
    ).content;
    const row = csv.split("\n")[1];
    expect(row).toContain("押し目買い|ブレイク");
    expect(row).toContain(",,"); // SL・TPなどの空欄
  });

  it("JSONは全項目とサマリーを含む", () => {
    const j = JSON.parse(buildExport(input({ format: "json" })).content);
    expect(j.trades).toHaveLength(1);
    expect(j.summary.n).toBe(1);
    expect(j.rules[0].title).toBe("SLを必ず入れる");
  });

  it("ファイル名と形式", () => {
    const o = buildExport(input({ format: "csv" }));
    expect(o).toMatchObject({
      filename: "fx-review-trades-2026-10-24.csv",
      mime: "text/csv",
      tradeCount: 1,
    });
  });
});

describe("期間ラベル（from/to指定）", () => {
  it("from/toどちらも無指定なら「すべて」", () => {
    const md = buildExport(input()).content;
    expect(md).toContain("- 期間: すべて /");
  });

  it("fromのみなら「開始日〜現在」", () => {
    const md = buildExport(input({ from: "2026-10-01T00:00:00Z" })).content;
    expect(md).toContain("- 期間: 2026-10-01〜現在 /");
  });

  it("from/to指定なら、toは排他的上限として1日前の日付で表示する", () => {
    const md = buildExport(
      input({
        from: "2026-10-01T00:00:00Z",
        // 「期間を指定」の終了日の翌日0時（JST）に相当する排他的上限
        to: "2026-10-15T15:00:00Z",
      }),
    ).content;
    expect(md).toContain("- 期間: 2026-10-01〜2026-10-15 /");
  });

  it("JSONのrangeにはfrom/to/labelを入れる", () => {
    const j = JSON.parse(
      buildExport(
        input({ format: "json", from: "2026-10-01T00:00:00Z" }),
      ).content,
    );
    expect(j.range).toEqual({
      from: "2026-10-01T00:00:00Z",
      to: null,
      label: "2026-10-01〜現在",
    });
  });
});
