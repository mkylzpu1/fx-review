import { describe, it, expect } from "vitest";
import {
  parseAiResponse,
  sampleNOf,
  splitSections,
} from "../../../src/services/note/parseAiResponse";

describe("sampleNOf", () => {
  it("n=12 や（12件）から件数を読む。全角数字も読む", () => {
    expect(sampleNOf("東京時間は平均+0.4R（n=12）")).toBe(12);
    expect(sampleNOf("損切りが遅い（１５件）")).toBe(15);
    expect(sampleNOf("件数の記載なし")).toBeNull();
  });
});

describe("splitSections", () => {
  it("見出しごとに分け、空行は捨てる", () => {
    const s = splitSections("前置き\n\n## 改善案\n- a\n\n## 勝ち負け\n本文");
    expect(s.map((x) => x.heading)).toEqual(["", "改善案", "勝ち負け"]);
    expect(s[1].lines).toEqual(["- a"]);
  });
});

describe("parseAiResponse", () => {
  it("番号付き行と箇条書きを1行ずつ取り出し、太字の記号は外す", () => {
    const r = parseAiResponse(
      [
        "## 次の2週間で守る改善ルール",
        "1. **エントリー前にSLを必ず入れる**（n=8）",
        "2) 15分足のEMA21から離れたら入らない",
        "- ロスカット後は30分休む",
        "・ 連敗3回で当日は終了",
      ].join("\n"),
    );
    expect(r.improvements.map((i) => i.text)).toEqual([
      "エントリー前にSLを必ず入れる（n=8）",
      "15分足のEMA21から離れたら入らない",
      "ロスカット後は30分休む",
      "連敗3回で当日は終了",
    ]);
    expect(r.improvements[0].sampleN).toBe(8);
  });

  it("「改善」「ルール」などの見出しがあれば、その節だけから拾う", () => {
    const r = parseAiResponse(
      [
        "## 勝ちと負けを分ける条件",
        "- 東京時間は勝ちやすい傾向がある",
        "## 改善提案",
        "- SLを必ず入れる",
      ].join("\n"),
    );
    expect(r.improvements.map((i) => i.text)).toEqual(["SLを必ず入れる"]);
  });

  it("該当する見出しが無ければ全体から拾い、重複は1つにする", () => {
    const r = parseAiResponse(
      "## 分析\n- SLを必ず入れる\n- SLを必ず入れる\n- 短い",
    );
    expect(r.improvements).toHaveLength(1);
  });

  it("構造のない自由文は、改善案も節も空にして原文表示に任せる", () => {
    const r = parseAiResponse(
      "全体としては良い傾向です。引き続き頑張りましょう。",
    );
    expect(r).toEqual({ sections: [], improvements: [] });
  });

  it("長い行は切り詰め、件数の上限を超えた分は捨てる", () => {
    const many = Array.from(
      { length: 40 },
      (_, i) => `- 改善案その${i}を守る`,
    ).join("\n");
    expect(parseAiResponse(many).improvements).toHaveLength(30);
    const long = parseAiResponse(`- ${"あ".repeat(500)}`).improvements[0].text;
    expect(long).toHaveLength(300);
  });
});
