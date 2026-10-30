import { strToU8, zipSync, type Zippable } from "fflate";
import { dayBundleSchema, manifestSchema } from "./bundleSchema";
import {
  buildDayBundles,
  buildManifest,
  toJson,
  type BuildOptions,
} from "./buildDayJson";
import type { Trade } from "@/features/trades/types";

export const zipFileName = (from: string, to: string) =>
  `tremiru-blog_${from}_${to}.zip`;

/** 画像の中身: day.json の相対パス（charts/01_USDJPY_1m.png）→ PNGのバイト列 */
export type DayImages = ReadonlyMap<string, Uint8Array>;

export interface BuildZipInput extends BuildOptions {
  generatedAt?: Date;
  /** 日付 → 画像（無ければ画像なし） */
  images?: ReadonlyMap<string, DayImages>;
}

export interface ZipResult {
  /** zipのバイト列 */
  bytes: Uint8Array;
  fileName: string;
  /** 0件のとき true（このとき bytes は空で、zipは作らない） */
  empty: boolean;
  manifest: ReturnType<typeof buildManifest>;
}

/**
 * zipを組み立てる。JSONは契約（zod）で検証してから入れる。
 * PNGは再圧縮せず無圧縮（store）、JSONは通常の圧縮。
 */
export function buildZip(
  trades: readonly Trade[],
  input: BuildZipInput,
): ZipResult {
  const built = buildDayBundles(trades, input);
  const manifest = manifestSchema.parse(
    buildManifest(built, {
      timeZone: input.timeZone,
      from: input.from,
      to: input.to,
      includeOpen: input.includeOpen,
      generatedAt: input.generatedAt,
    }),
  );
  const fileName = zipFileName(input.from, input.to);
  if (built.days.length === 0)
    return { bytes: new Uint8Array(), fileName, empty: true, manifest };

  const files: Zippable = {
    "manifest.json": [strToU8(toJson(manifest)), { level: 6 }],
  };
  for (const day of built.days) {
    const parsed = dayBundleSchema.parse(day);
    files[`days/${day.date}/day.json`] = [
      strToU8(toJson(parsed)),
      { level: 6 },
    ];
    for (const [rel, png] of input.images?.get(day.date) ?? [])
      files[`days/${day.date}/${rel}`] = [png, { level: 0 }];
  }
  return { bytes: zipSync(files), fileName, empty: false, manifest };
}
