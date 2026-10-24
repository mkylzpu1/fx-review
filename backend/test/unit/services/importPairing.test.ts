import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseJstDateTime,
  parseRakutenFile,
} from "../../../src/services/import/rakutenCsv";
import { pairExecutions } from "../../../src/services/import/pairing";
import {
  buildSample,
  csvOf,
  jstAt,
  type Fill,
} from "../../fixtures/rakutenSample";

const rowsOf = (fills: Fill[], name = "a.csv") =>
  parseRakutenFile(name, csvOf(fills));

const fill = (o: Partial<Fill> & Pick<Fill, "no" | "kind" | "side">): Fill => ({
  qty: 10000,
  rate: 150,
  pnl: o.kind === "決済" ? 0 : null,
  at: jstAt(o.no % 1000),
  ...o,
});

describe("parseCsv", () => {
  it("引用符・エスケープ・CRLF・BOMを扱う", () => {
    const t = '\uFEFF"a","b""c","d,e"\r\n"1","2","3"\r\n';
    expect(parseCsv(t)).toEqual([
      ["a", 'b"c', "d,e"],
      ["1", "2", "3"],
    ]);
  });
  it("最終行に改行が無くても読める", () => {
    expect(parseCsv('"a","b"\n"1","2"')).toHaveLength(2);
  });
});

describe("parseJstDateTime", () => {
  it("JSTをUTCに直す（秒なし）", () => {
    expect(parseJstDateTime("2026/10/01 22:10")).toBe("2026-10-01T13:10:00Z");
  });
  it("日付をまたぐ（JST 0時台 → 前日のUTC）", () => {
    expect(parseJstDateTime("2026/10/02 00:05")).toBe("2026-10-01T15:05:00Z");
  });
  it("存在しない日付・形式違いは null", () => {
    expect(parseJstDateTime("2026/02/30 10:00")).toBeNull();
    expect(parseJstDateTime("2026-10-01 10:00")).toBeNull();
    expect(parseJstDateTime("2026/10/01 25:00")).toBeNull();
  });
});

describe("parseRakutenFile", () => {
  it("約定日時の列が無い別形式はファイル単位でエラーにする", () => {
    const r = parseRakutenFile("other.csv", '"日付","金額"\r\n"1","2"\r\n');
    expect(r.file.status).toBe("error");
    expect(r.file.message).toContain("約定日時");
    expect(r.rows).toEqual([]);
  });
  it("空ファイルはエラー", () => {
    expect(parseRakutenFile("e.csv", "").file.status).toBe("error");
  });
  it("ドル/円以外は行ごとのエラー（他の行は読む）", () => {
    const r = rowsOf([
      fill({ no: 1, kind: "新規", side: "買" }),
      fill({ no: 2, kind: "新規", side: "買", pair: "ユーロ/円" }),
    ]);
    expect(r.file.status).toBe("ok");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("対応していない通貨ペア");
    expect(r.errors[0].executionNo).toBe("2");
  });
  it("新規行の損益「-」は無視し、決済行の損益が不正ならエラー", () => {
    const ok = rowsOf([
      fill({ no: 1, kind: "新規", side: "買" }),
      fill({ no: 2, kind: "決済", side: "売", pnl: -1500 }),
    ]);
    expect(ok.errors).toEqual([]);
    expect(ok.rows.find((r) => r.no === "2")?.pnlJpy).toBe(-1500);
    const bad = parseRakutenFile(
      "b.csv",
      csvOf([fill({ no: 2, kind: "決済", side: "売", pnl: 1 })]).replace(
        '"1","1"',
        '"-","-"',
      ),
    );
    expect(bad.errors[0].message).toContain("取引損益");
  });
});

describe("pairExecutions", () => {
  it("サンプル形式（211件・同時保有を含む）が全件ペアになり、損益も価格差と一致する", () => {
    const { fills, expectedPairs } = buildSample();
    const parsed = rowsOf(fills);
    expect(parsed.rows).toHaveLength(fills.length);
    const r = pairExecutions(parsed.rows);
    expect(r.errors).toEqual([]);
    expect(r.trades).toHaveLength(211);
    expect(r.trades.every((t) => t.status === "closed")).toBe(true);
    const got = r.trades
      .map((t) => [Number(t.entryNo), Number(t.exitNo)])
      .sort((a, b) => a[0] - b[0]);
    expect(got).toEqual([...expectedPairs].sort((a, b) => a[0] - b[0]));
    // 新規と決済のNoが隣り合わないペアがある（隣の行とペアにしていない）
    expect(got.filter(([a, b]) => b - a !== 1).length).toBeGreaterThanOrEqual(
      13,
    );
    // 損益の不一致が0件
    for (const t of r.trades) {
      const sign = t.side === "buy" ? 1 : -1;
      expect(
        Math.round(sign * (t.exitPrice! - t.entryPrice) * t.lots * 100000),
      ).toBe(t.pnlJpy);
    }
  });

  it("売買の向き・lots・source_keyを変換する", () => {
    const r = pairExecutions(
      rowsOf([
        fill({ no: 1, kind: "新規", side: "売", qty: 5000, rate: 150.2 }),
        fill({
          no: 2,
          kind: "決済",
          side: "買",
          qty: 5000,
          rate: 150.1,
          pnl: 50,
        }),
      ]).rows,
    );
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t.side).toBe("sell");
    expect(t.lots).toBe(0.05);
    expect(t.sourceKey).toBe("rakuten:1:2");
    expect(t.pnlJpy).toBe(50);
    expect(t.entryAt).toBe("2026-10-01T13:11:00Z");
  });

  it("対応する新規が無い決済はエラー行", () => {
    const r = pairExecutions(
      rowsOf([fill({ no: 5, kind: "決済", side: "売", pnl: 10 })]).rows,
    );
    expect(r.trades).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("対応する新規");
  });

  it("数量が一致しないペアはエラー行（分割決済は対象外）", () => {
    const r = pairExecutions(
      rowsOf([
        fill({ no: 1, kind: "新規", side: "買", qty: 10000 }),
        fill({ no: 2, kind: "決済", side: "売", qty: 5000, pnl: 5 }),
      ]).rows,
    );
    expect(r.trades).toEqual([]);
    expect(r.errors[0].message).toContain("数量が一致しません");
  });

  it("決済されていない新規は未決済のトレードにする", () => {
    const r = pairExecutions(
      rowsOf([fill({ no: 1, kind: "新規", side: "買" })]).rows,
    );
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({
      status: "open",
      exitAt: null,
      exitPrice: null,
      pnlJpy: null,
      sourceKey: "rakuten:1:",
    });
  });

  it("買いと売りは別のキューで、決済は逆の売買のポジションに当たる", () => {
    const r = pairExecutions(
      rowsOf([
        fill({ no: 1, kind: "新規", side: "買", rate: 150 }),
        fill({ no: 2, kind: "新規", side: "売", rate: 151 }),
        fill({ no: 3, kind: "決済", side: "買", rate: 150.5, pnl: 5 }), // 売りを決済
        fill({ no: 4, kind: "決済", side: "売", rate: 150.5, pnl: 5 }), // 買いを決済
      ]).rows,
    );
    const pairs = r.trades.map((t) => `${t.entryNo}-${t.exitNo}:${t.side}`);
    expect(pairs.sort()).toEqual(["1-4:buy", "2-3:sell"]);
  });

  it("複数ファイルで重なる同じ約定No.は1件にする", () => {
    const a = rowsOf(
      [
        fill({ no: 1, kind: "新規", side: "買" }),
        fill({ no: 2, kind: "決済", side: "売", pnl: 1 }),
      ],
      "a.csv",
    );
    const b = rowsOf(
      [
        fill({ no: 2, kind: "決済", side: "売", pnl: 1 }),
        fill({ no: 3, kind: "新規", side: "買" }),
      ],
      "b.csv",
    );
    const r = pairExecutions([...a.rows, ...b.rows]);
    expect(r.duplicateRows).toBe(1);
    expect(r.trades.map((t) => t.sourceKey).sort()).toEqual([
      "rakuten:1:2",
      "rakuten:3:",
    ]);
  });

  it("ファイルをまたぐ新規と決済もペアになる", () => {
    const a = rowsOf([fill({ no: 1, kind: "新規", side: "買" })], "a.csv");
    const b = rowsOf(
      [fill({ no: 2, kind: "決済", side: "売", pnl: 3 })],
      "b.csv",
    );
    const r = pairExecutions([...b.rows, ...a.rows]);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].status).toBe("closed");
  });
});
