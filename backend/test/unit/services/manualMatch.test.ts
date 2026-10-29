import { describe, expect, it } from "vitest";
import { matchManualTrades } from "../../../src/services/import/manualMatch";
import type { ImportTrade, ManualTrade } from "../../../src/types/import";

const csv = (o: Partial<ImportTrade> & Pick<ImportTrade, "sourceKey">) =>
  ({
    entryNo: "1",
    exitNo: "2",
    pair: "USDJPY",
    side: "buy",
    lots: 1,
    entryAt: "2026-10-29T03:00:00Z", // 日本時間 12:00
    entryPrice: 150.0,
    exitAt: "2026-10-29T04:00:00Z",
    exitPrice: 150.3,
    pnlJpy: 3000,
    status: "closed",
    ...o,
  }) as ImportTrade;

const manual = (o: Partial<ManualTrade> & Pick<ManualTrade, "id">) =>
  ({
    pair: "USDJPY",
    side: "buy",
    lots: 1,
    entryAt: "2026-10-29T03:00:00Z",
    entryPrice: 150.0,
    exitAt: "2026-10-29T04:00:00Z",
    ...o,
  }) as ManualTrade;

describe("matchManualTrades", () => {
  it("同じ取引（ペア・売買・ロット・時刻・価格が一致）を対応づける", () => {
    const r = matchManualTrades(
      [csv({ sourceKey: "k1" })],
      [manual({ id: "m1" })],
    );
    expect(r.get("k1")).toBe("m1");
  });

  it("時刻・価格は基準内ならずれていてよい（30分・0.05円まで）", () => {
    const near = manual({
      id: "m1",
      entryAt: "2026-10-29T03:30:00Z",
      entryPrice: 150.05,
    });
    expect(matchManualTrades([csv({ sourceKey: "k1" })], [near]).size).toBe(1);
    const farTime = manual({ id: "m2", entryAt: "2026-10-29T03:31:00Z" });
    expect(matchManualTrades([csv({ sourceKey: "k1" })], [farTime]).size).toBe(
      0,
    );
    const farPrice = manual({ id: "m3", entryPrice: 150.06 });
    expect(matchManualTrades([csv({ sourceKey: "k1" })], [farPrice]).size).toBe(
      0,
    );
  });

  it("日本時間とMT5時間を取り違えた入力（数時間ずれ）は同じ取引とみなさない", () => {
    // 日本時間 12:00 のところを、MT5の表示（サーバー 5:00）のまま 5:00 と入力した場合
    const wrong = manual({ id: "m1", entryAt: "2026-10-28T20:00:00Z" });
    expect(matchManualTrades([csv({ sourceKey: "k1" })], [wrong]).size).toBe(0);
  });

  it("売買・ロット・通貨ペアが違えば別の取引", () => {
    const t = [csv({ sourceKey: "k1" })];
    expect(matchManualTrades(t, [manual({ id: "a", side: "sell" })]).size).toBe(
      0,
    );
    expect(matchManualTrades(t, [manual({ id: "b", lots: 0.5 })]).size).toBe(0);
    expect(
      matchManualTrades(t, [manual({ id: "c", pair: "EURUSD" })]).size,
    ).toBe(0);
  });

  it("双方に決済時刻があって離れていれば別の取引。片方が未決済なら見ない", () => {
    const t = [csv({ sourceKey: "k1" })];
    const farExit = manual({ id: "a", exitAt: "2026-10-29T06:00:00Z" });
    expect(matchManualTrades(t, [farExit]).size).toBe(0);
    const openManual = manual({ id: "b", exitAt: null });
    expect(matchManualTrades(t, [openManual]).get("k1")).toBe("b");
    const openCsv = csv({ sourceKey: "k2", exitAt: null, status: "open" });
    expect(matchManualTrades([openCsv], [farExit]).get("k2")).toBe("a");
  });

  it("手入力1件に対応づけるのはCSV1件だけ。時刻が近い方を選ぶ", () => {
    const r = matchManualTrades(
      [
        csv({ sourceKey: "far", entryAt: "2026-10-29T03:10:00Z" }),
        csv({ sourceKey: "near", entryAt: "2026-10-29T03:01:00Z" }),
      ],
      [manual({ id: "m1" })],
    );
    expect([...r.entries()]).toEqual([["near", "m1"]]);
  });

  it("手入力が2件あれば、CSVの2件がそれぞれ対応づく", () => {
    const r = matchManualTrades(
      [
        csv({ sourceKey: "k1", entryAt: "2026-10-29T03:00:00Z" }),
        csv({ sourceKey: "k2", entryAt: "2026-10-29T03:20:00Z" }),
      ],
      [
        manual({ id: "m1", entryAt: "2026-10-29T03:02:00Z" }),
        manual({ id: "m2", entryAt: "2026-10-29T03:19:00Z" }),
      ],
    );
    expect(Object.fromEntries(r)).toEqual({ k1: "m1", k2: "m2" });
  });

  it("手入力が無ければ何も対応づけない", () => {
    expect(matchManualTrades([csv({ sourceKey: "k1" })], []).size).toBe(0);
  });
});
