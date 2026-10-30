import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { dayBundleSchema, manifestSchema } from "../bundleSchema";
import { buildZip, zipFileName } from "../buildZip";
import { makeTrade } from "./fixtures";

const opts = {
  timeZone: "Asia/Tokyo",
  from: "2026-10-28",
  to: "2026-10-29",
  includeOpen: false,
  generatedAt: new Date("2026-10-30T03:00:00Z"),
};
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe("buildZip", () => {
  it("ファイル名は tremiru-blog_<from>_<to>.zip", () => {
    expect(zipFileName("2026-10-28", "2026-10-29")).toBe(
      "tremiru-blog_2026-10-28_2026-10-29.zip",
    );
  });
  it("manifest.json と days/<日付>/day.json（+画像）の構成になり、中身がスキーマに適合する", () => {
    const a = makeTrade({ entryAt: "2026-10-28T01:00:00Z" });
    const b = makeTrade({ entryAt: "2026-10-29T01:00:00Z" });
    const r = buildZip([a, b], {
      ...opts,
      images: new Map([
        ["2026-10-29", new Map([["charts/01_USDJPY_1m.png", png]])],
      ]),
    });
    expect(r.empty).toBe(false);
    expect(r.fileName).toBe("tremiru-blog_2026-10-28_2026-10-29.zip");
    const files = unzipSync(r.bytes);
    expect(Object.keys(files).sort()).toEqual([
      "days/2026-10-28/day.json",
      "days/2026-10-29/charts/01_USDJPY_1m.png",
      "days/2026-10-29/day.json",
      "manifest.json",
    ]);
    const m = manifestSchema.parse(
      JSON.parse(strFromU8(files["manifest.json"])),
    );
    expect(m.days).toEqual(["2026-10-28", "2026-10-29"]);
    for (const d of m.days)
      expect(() =>
        dayBundleSchema.parse(
          JSON.parse(strFromU8(files[`days/${d}/day.json`])),
        ),
      ).not.toThrow();
    expect(
      Array.from(files["days/2026-10-29/charts/01_USDJPY_1m.png"]),
    ).toEqual(Array.from(png));
  });
  it("0件のときは空のzipを作らない", () => {
    const r = buildZip([], opts);
    expect(r.empty).toBe(true);
    expect(r.bytes.length).toBe(0);
  });
});
