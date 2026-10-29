import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CsvCandleProvider,
  parseCsvLine,
  serverToUtc,
} from "../../../src/services/candles/CsvCandleProvider";

describe("serverToUtc", () => {
  it("固定オフセットを引いてUTCにする", () => {
    expect(serverToUtc(10_000, 2)).toBe(10_000 - 7200);
    expect(serverToUtc(10_000, 0)).toBe(10_000);
  });

  it("ny-close: 冬は UTC+2、夏は UTC+3", () => {
    const winter = Date.UTC(2026, 0, 15, 12, 0, 0) / 1000; // サーバー時刻の見た目 12:00
    expect(serverToUtc(winter, "ny-close")).toBe(winter - 2 * 3600);
    const summer = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;
    expect(serverToUtc(summer, "ny-close")).toBe(summer - 3 * 3600);
  });
});

describe("serverToUtc: eet（欧州式の夏時間）", () => {
  const at = (y: number, m: number, d: number, h: number, mi = 0) =>
    Date.UTC(y, m - 1, d, h, mi, 0) / 1000;

  it("冬は UTC+2、夏は UTC+3", () => {
    expect(serverToUtc(at(2026, 1, 15, 12), "eet")).toBe(at(2026, 1, 15, 10));
    expect(serverToUtc(at(2026, 7, 15, 12), "eet")).toBe(at(2026, 7, 15, 9));
  });

  it("2026/10/29（欧州は冬時間・米国はまだ夏時間）: サーバー 5:00 は日本時間 12:00", () => {
    const utc = serverToUtc(at(2026, 10, 29, 5), "eet");
    expect(utc).toBe(at(2026, 10, 29, 3));
    // 日本時間 = UTC + 9時間
    expect(new Date((utc + 9 * 3600) * 1000).toISOString()).toBe(
      "2026-10-29T12:00:00.000Z",
    );
  });

  it("欧州と米国で切り替え日が違う期間は、ny-close と1時間食い違う", () => {
    const gap = at(2026, 10, 29, 5);
    expect(serverToUtc(gap, "ny-close") - serverToUtc(gap, "eet")).toBe(-3600);
    // 切り替え日が同じ時期は一致する
    for (const d of [at(2026, 1, 15, 12), at(2026, 7, 15, 12)])
      expect(serverToUtc(d, "ny-close")).toBe(serverToUtc(d, "eet"));
  });

  it("夏時間の切り替え（2026/10/25 EU）の前後で、足が連続してつながる", () => {
    // 切り替え前の夏時間 UTC+3 の 02:59 と、切り替え後の冬時間 UTC+2 の 03:00（同じUTC 23:59 → 01:00 の流れ）
    expect(serverToUtc(at(2026, 10, 25, 2, 59), "eet")).toBe(
      at(2026, 10, 24, 23, 59),
    );
    expect(serverToUtc(at(2026, 10, 25, 5), "eet")).toBe(at(2026, 10, 25, 3));
  });
});

describe("parseCsvLine", () => {
  it("正しい行を読む", () => {
    expect(parseCsvLine("1000,150.1,150.2,150.0,150.15", 0)).toEqual({
      time: 1000,
      open: 150.1,
      high: 150.2,
      low: 150.0,
      close: 150.15,
    });
  });
  it("eet でUTCに直して返す", () => {
    const server = Date.UTC(2026, 9, 29, 5, 0, 0) / 1000;
    expect(
      parseCsvLine(`${server},150.1,150.2,150.0,150.15`, "eet")?.time,
    ).toBe(Date.UTC(2026, 9, 29, 3, 0, 0) / 1000);
  });
  it("壊れた行・空行は null", () => {
    expect(parseCsvLine("", 0)).toBeNull();
    expect(parseCsvLine("a,b,c,d,e", 0)).toBeNull();
    expect(parseCsvLine("1,2,3", 0)).toBeNull();
  });
});

describe("CsvCandleProvider", () => {
  it("範囲内の足だけを時刻順・重複なしで返す", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "csv-"));
    await writeFile(
      path.join(dir, "a.csv"),
      ["120,2,3,1,2", "60,1,2,0,1", "60,1,2,0,1", "bad", "9999,1,1,1,1"].join(
        "\n",
      ),
    );
    const p = new CsvCandleProvider(dir, 0);
    const out = await p.fetch1m("USDJPY", new Date(60_000), new Date(180_000));
    expect(out.map((c) => c.time)).toEqual([60, 120]);
  });

  it("フォルダが無い・CSVが無いときは分かりやすいエラー", async () => {
    await expect(
      new CsvCandleProvider("/no/such/dir", 0).fetch1m(
        "USDJPY",
        new Date(0),
        new Date(1000),
      ),
    ).rejects.toThrow("CSVフォルダを読めませんでした");
    const empty = await mkdtemp(path.join(tmpdir(), "csv-"));
    await expect(
      new CsvCandleProvider(empty, 0).fetch1m(
        "USDJPY",
        new Date(0),
        new Date(1000),
      ),
    ).rejects.toThrow(".csv がありません");
  });
});
