import { z } from "zod";
import type { TradeInput } from "../../types/trade";

const nullableText = (max: number) =>
  z.string().trim().max(max, `${max}文字までです`).nullish();

const nullablePrice = z
  .number()
  .positive("価格は0より大きい値で入力してください")
  .nullish();

/** POST /trades, PUT /trades/{id} のボディ。SL・TP・根拠などは任意 */
export const TradeBodySchema = z.object({
  pair: z.string().min(1, "通貨ペアを選択してください"),
  side: z.enum(["buy", "sell"]),
  lots: z
    .number()
    .positive("ロットは0より大きい値で入力してください")
    .max(1000, "ロットが大きすぎます")
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
      "ロットは小数第2位までです",
    ),
  entryAt: z
    .string()
    .datetime({ offset: true, message: "エントリー日時の形式が不正です" }),
  entryPrice: z.number().positive("価格は0より大きい値で入力してください"),
  slPrice: nullablePrice,
  tpPrice: nullablePrice,
  slReason: nullableText(1000),
  tpReason: nullableText(1000),
  rationaleMemo: nullableText(5000),
  confidence: z.number().int().min(1).max(5).nullish(),
  exitAt: z
    .string()
    .datetime({ offset: true, message: "決済日時の形式が不正です" })
    .nullish(),
  exitPrice: nullablePrice,
  exitMethod: z.enum(["tp", "sl", "manual", "breakeven"]).nullish(),
  insight: nullableText(5000),
  nextRule: nullableText(1000),
  draft: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).max(30).optional(),
  ruleChecks: z
    .array(
      z.object({
        ruleId: z.string().uuid(),
        result: z.enum(["ok", "ng", "na"]),
      }),
    )
    .max(100)
    .optional(),
});

/** ボディ → サービスの入力。未指定は null / 空配列に揃える */
export function toTradeInput(b: z.infer<typeof TradeBodySchema>): TradeInput {
  return {
    pair: b.pair,
    side: b.side,
    lots: b.lots,
    entryAt: b.entryAt,
    entryPrice: b.entryPrice,
    slPrice: b.slPrice ?? null,
    tpPrice: b.tpPrice ?? null,
    slReason: b.slReason || null,
    tpReason: b.tpReason || null,
    rationaleMemo: b.rationaleMemo || null,
    confidence: b.confidence ?? null,
    exitAt: b.exitAt ?? null,
    exitPrice: b.exitPrice ?? null,
    exitMethod: b.exitMethod ?? "open",
    insight: b.insight || null,
    nextRule: b.nextRule || null,
    draft: b.draft ?? false,
    tagIds: b.tagIds ?? [],
    ruleChecks: b.ruleChecks ?? [],
  };
}

/** 範囲つきの整数クエリ（文字列のまま検証し、数値化は parseIntParam で行う） */
const intParam = (name: string, min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, `${name}は整数で指定してください`)
    .refine(
      (v) => Number(v) >= min && Number(v) <= max,
      `${name}は${min}〜${max}で指定してください`,
    )
    .optional();

export function parseIntParam(v: string | undefined, def: number): number {
  return v === undefined ? def : Number(v);
}

const SortSchema = z
  .enum(["entry_desc", "entry_asc", "pnl_desc", "pnl_asc"])
  .optional();
const DateParam = z
  .string()
  .datetime({ offset: true, message: "日時はISO形式で指定してください" })
  .optional();

export const ListQuerySchema = z.object({
  result: z.enum(["win", "loss"]).optional(),
  deviationOnly: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
  pair: z.string().optional(),
  from: DateParam,
  to: DateParam,
  pending: z.enum(["true", "false"]).optional(),
  sort: SortSchema,
  page: intParam("page", 1, 100000),
  limit: intParam("limit", 1, 100),
});

export const QueueQuerySchema = z.object({
  filter: z.enum(["all", "sl_tp", "no_rationale", "open", "loss"]).optional(),
  sort: SortSchema,
  page: intParam("page", 1, 100000),
  limit: intParam("limit", 1, 100),
});
