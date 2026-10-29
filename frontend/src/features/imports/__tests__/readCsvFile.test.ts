import { describe, it, expect } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  decodeShiftJis,
  readCsvFiles,
} from "../utils/readCsvFile";

/** 「ドル/円」をShift_JISにしたバイト列 */
const SJIS = new Uint8Array([0x83, 0x68, 0x83, 0x8b, 0x2f, 0x89, 0x7e]);

const sjisFile = (name: string) => new File([SJIS], name, { type: "text/csv" });

describe("decodeShiftJis", () => {
  it("Shift_JISのバイト列を日本語にする", async () => {
    expect(await decodeShiftJis(SJIS.buffer)).toBe("ドル/円");
  });
});

describe("readCsvFiles", () => {
  it("複数ファイルを文字化けなく読む", async () => {
    const r = await readCsvFiles([sjisFile("a.csv"), sjisFile("b.csv")]);
    expect(r.failures).toEqual([]);
    expect(r.files.map((f) => f.text)).toEqual(["ドル/円", "ドル/円"]);
  });

  it("10MBを超えるファイルだけ弾き、ほかは読む", async () => {
    const big = sjisFile("big.csv");
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    const r = await readCsvFiles([big, sjisFile("ok.csv")]);
    expect(r.files.map((f) => f.name)).toEqual(["ok.csv"]);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].name).toBe("big.csv");
    expect(r.failures[0].message).toContain("10MB");
  });

  it("ファイル数の上限を超えた分は失敗にする", async () => {
    const many = Array.from({ length: MAX_FILES + 2 }, (_, i) =>
      sjisFile(`f${i}.csv`),
    );
    const r = await readCsvFiles(many);
    expect(r.files).toHaveLength(MAX_FILES);
    expect(r.failures).toHaveLength(2);
  });
});
