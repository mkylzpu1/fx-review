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
