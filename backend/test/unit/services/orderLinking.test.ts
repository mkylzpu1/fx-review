import { describe, it, expect } from "vitest";
import {
  groupOrders,
  linkPlansToTrades,
} from "../../../src/services/import/orderLinking";
import {
  isOrderCsv,
  parseRakutenOrderFile,
} from "../../../src/services/import/rakutenOrderCsv";
import type { CandidateTrade } from "../../../src/types/orderImport";

const HEADER = [
  "注文No.",
  "注文パターン",
  "通貨ペア",
  "注文区分",
  "売買",
  "注文日時",
  "有効期限",
  "状態",
  "執行区分",
  "受注数量",
  "注文レート",
  "約定レート",
  "建約定レート",
  "トレール幅",
];
const q = (v: string) => `"${v}"`;
const csv = (rows: string[][]) =>
  [HEADER, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
// [no, pattern, kind, side, at, state, exec, rate, fill, open]
const o = (
  no: number,
  pattern: string,
  kind: string,
  side: string,
  at: string,
  state: string,
  exec: string,
  rate: string,
  fill = "",
  open = "",
) => [
  String(no),
  pattern,
  "ドル/円",
  kind,
  side,
  at,
  "期限なし",
  state,
  exec,
  "10000",
  rate,
  fill,
  open,
  "",
];

const parse = (rows: string[][]) => parseRakutenOrderFile("o.csv", csv(rows));
const T = "2026/10/26 09:19"; // JST → 00:19Z
const trade = (
  o: Partial<CandidateTrade> & Pick<CandidateTrade, "id">,
): CandidateTrade => ({
  side: "sell",
  lots: 1,
  entryAt: "2026-10-26T00:19:00Z",
  entryPrice: 157.12,
  exitPrice: null,
  slPrice: null,
  tpPrice: null,
  exitMethod: "manual",
  ...o,
});

describe("isOrderCsv", () => {
  it("注文履歴は true、約定履歴は false", () => {
    expect(isOrderCsv(csv([]))).toBe(true);
    expect(isOrderCsv('"約定No.","通貨ペア"\r\n')).toBe(false);
  });
});

describe("parseRakutenOrderFile", () => {
  it("必要な列が無ければファイル単位のエラー", () => {
    const r = parseRakutenOrderFile("x.csv", '"注文No.","売買"\r\n"1","買"');
    expect(r.file.status).toBe("error");
  });
});

describe("groupOrders", () => {
  it("IFO: 約定した逆指値はSL、失効した指値はTPとして読む", () => {
    const { rows } = parse([
      o(
        4431,
        "IFO一次",
        "新規",
        "売",
        T,
        "約定済",
        "指値",
        "157.120",
        "157.120",
      ),
      o(
        4432,
        "IFO二次",
        "決済",
        "買",
        T,
        "取消済（失効）",
        "指値",
        "156.860",
        "",
        "157.120",
      ),
      o(
        4433,
        "IFO二次",
        "決済",
        "買",
        T,
        "約定済",
        "逆指値",
        "157.220",
        "157.221",
        "157.120",
      ),
    ]);
    const g = groupOrders(rows);
    expect(g.plans).toHaveLength(1);
    expect(g.plans[0]).toMatchObject({
      side: "sell",
      entryRate: 157.12,
      slPrice: 157.22,
      tpPrice: 156.86,
      exitHint: "sl",
      exitRate: 157.221,
    });
  });

  it("全決済で閉じ、SL・TP注文が全決済で取り消されても、その値をSL・TPとして残す", () => {
    const { rows } = parse([
      o(
        1,
        "ストリーミング",
        "新規",
        "買",
        T,
        "約定済",
        "マーケット",
        "157.0",
        "157.0",
      ),
      o(
        2,
        "OCO",
        "決済",
        "売",
        T,
        "取消済（全決済）",
        "指値",
        "157.2",
        "",
        "157.0",
      ),
      o(
        3,
        "OCO",
        "決済",
        "売",
        T,
        "取消済（全決済）",
        "逆指値",
        "156.9",
        "",
        "157.0",
      ),
      o(
        4,
        "全決済",
        "決済",
        "売",
        T,
        "約定済",
        "マーケット",
        "157.1",
        "157.1",
        "157.0",
      ),
    ]);
    const [p] = groupOrders(rows).plans;
    expect(p).toMatchObject({
      slPrice: 156.9,
      tpPrice: 157.2,
      exitHint: "manual",
    });
  });

  it("取消・期限切れ・待機中は unfilled、リジェクトは件数だけ数える", () => {
    const { rows } = parse([
      o(1, "IFO一次", "新規", "買", T, "取消済（注文取消）", "指値", "156.55"),
      o(2, "IFO二次", "決済", "売", T, "取消済（注文取消）", "指値", "156.75"),
      o(
        3,
        "IFO二次",
        "決済",
        "売",
        T,
        "取消済（注文取消）",
        "逆指値",
        "156.45",
      ),
      o(
        4,
        "ストリーミング",
        "新規",
        "買",
        T,
        "リジェクト",
        "マーケット",
        "157.0",
      ),
      o(5, "IFO一次", "新規", "売", T, "有効", "指値", "157.35"),
    ]);
    const g = groupOrders(rows);
    expect(g.plans).toHaveLength(0);
    expect(g.rejected).toBe(1);
    expect(
      g.unfilled.map((u) => [u.entryOrderNo, u.state, u.slPrice, u.tpPrice]),
    ).toEqual([
      [1, "取消済（注文取消）", 156.45, 156.75],
      [5, "有効", null, null],
    ]);
  });

  it("建約定レートが違う決済注文は別の建玉のものとして入れない", () => {
    const { rows } = parse([
      o(
        1,
        "ストリーミング",
        "新規",
        "買",
        T,
        "約定済",
        "マーケット",
        "157.0",
        "157.0",
      ),
      o(2, "OCO", "決済", "売", T, "約定済", "指値", "158.0", "158.0", "150.0"),
    ]);
    const [p] = groupOrders(rows).plans;
    expect(p.tpPrice).toBeNull();
    expect(p.exitHint).toBeNull();
  });
});

describe("linkPlansToTrades", () => {
  const plan = (rows: string[][]) => groupOrders(parse(rows).rows).plans;
  const ifo = (no: number, at = T) =>
    plan([
      o(
        no,
        "IFO一次",
        "新規",
        "売",
        at,
        "約定済",
        "指値",
        "157.120",
        "157.120",
      ),
      o(
        no + 1,
        "IFO二次",
        "決済",
        "買",
        at,
        "取消済（失効）",
        "指値",
        "156.860",
        "",
        "157.120",
      ),
      o(
        no + 2,
        "IFO二次",
        "決済",
        "買",
        at,
        "約定済",
        "逆指値",
        "157.220",
        "157.221",
        "157.120",
      ),
    ]);

  it("SL・TPを入れ、決済の仕方がmanualならslに直す", () => {
    const r = linkPlansToTrades(ifo(4431), [
      trade({ id: "a", exitPrice: 157.221 }),
    ]);
    expect(r.updates).toEqual([
      {
        tradeId: "a",
        entryOrderNo: 4431,
        slPrice: 157.22,
        tpPrice: 156.86,
        exitMethod: "sl",
      },
    ]);
  });

  it("入力済みのSL・TPは上書きしない。決済の仕方も手で直したものは残す", () => {
    const r = linkPlansToTrades(ifo(4431), [
      trade({
        id: "a",
        exitPrice: 157.221,
        slPrice: 157.5,
        tpPrice: 156.0,
        exitMethod: "breakeven",
      }),
    ]);
    expect(r.matched).toBe(1);
    expect(r.updates).toEqual([]);
  });

  it("注文日時より前のトレード・価格や売買が違うトレードには結びつけない", () => {
    const r = linkPlansToTrades(ifo(4431), [
      trade({ id: "early", entryAt: "2026-10-26T00:18:00Z" }),
      trade({ id: "price", entryPrice: 157.121 }),
      trade({ id: "side", side: "buy" }),
    ]);
    expect(r.matched).toBe(0);
    expect(r.unmatched).toHaveLength(1);
  });

  it("同じ価格・売買のトレードが続いても、1つの注文は1つのトレードにだけ結びつく", () => {
    const plans = [...ifo(10), ...ifo(20, "2026/10/26 09:25")];
    const r = linkPlansToTrades(plans, [
      trade({ id: "t1", entryAt: "2026-10-26T00:20:00Z" }),
      trade({ id: "t2", entryAt: "2026-10-26T00:26:00Z" }),
    ]);
    expect(r.updates.map((u) => [u.entryOrderNo, u.tradeId])).toEqual([
      [10, "t1"],
      [20, "t2"],
    ]);
  });

  it("決済済みのトレードは、決済価格が合わないものに結びつけない", () => {
    const r = linkPlansToTrades(ifo(4431), [
      trade({ id: "a", exitPrice: 150 }),
    ]);
    expect(r.matched).toBe(0);
  });

  it("利益側の逆指値はSLにしない（件数だけ数える）", () => {
    const p = plan([
      o(
        1,
        "ストリーミング",
        "新規",
        "買",
        T,
        "約定済",
        "マーケット",
        "157.0",
        "157.0",
      ),
      o(
        2,
        "OCO",
        "決済",
        "売",
        T,
        "約定済",
        "逆指値",
        "157.1",
        "157.1",
        "157.0",
      ),
    ]);
    const r = linkPlansToTrades(p, [
      trade({ id: "a", side: "buy", entryPrice: 157, exitPrice: 157.1 }),
    ]);
    expect(r.slOnProfitSide).toBe(1);
    expect(r.updates).toEqual([
      {
        tradeId: "a",
        entryOrderNo: 1,
        slPrice: null,
        tpPrice: null,
        exitMethod: "sl",
      },
    ]);
  });
});
