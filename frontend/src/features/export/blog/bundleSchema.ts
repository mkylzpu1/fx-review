import { z } from "zod";

/**
 * ブログ用zipの契約 v1（指示書 §5）。ブログ側の実装とのインターフェースなので、勝手に変更しない。
 * strict() にして、契約にない項目（残高・ID・メールなど）が混ざったら検証で落とす。
 */
export const SCHEMA_VERSION = 1 as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableNum = z.number().nullable();
const nullableStr = z.string().nullable();

export const WARNING_CODES = [
  "candles_missing",
  "memo_missing",
  "open_trade",
  "image_failed",
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export const warningSchema = z
  .object({
    date: dateStr,
    seq: z.number().int().nullable(),
    code: z.enum(WARNING_CODES),
    message: z.string(),
  })
  .strict();
export type BlogWarning = z.infer<typeof warningSchema>;

export const manifestSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    generatedAt: z.string(),
    timezone: z.string(),
    range: z.object({ from: dateStr, to: dateStr }).strict(),
    days: z.array(dateStr),
    includesOpenTrades: z.boolean(),
    warnings: z.array(warningSchema),
  })
  .strict();
export type Manifest = z.infer<typeof manifestSchema>;

export const tradeBundleSchema = z
  .object({
    seq: z.number().int().min(1),
    pair: z.string(),
    side: z.enum(["buy", "sell"]),
    lots: z.number(),
    status: z.string(),
    entryAt: z.string(),
    entryAtLocal: z.string(),
    exitAt: nullableStr,
    exitAtLocal: nullableStr,
    holdingMinutes: nullableNum,
    entryPrice: z.number(),
    exitPrice: nullableNum,
    slPrice: nullableNum,
    tpPrice: nullableNum,
    exitMethod: z.string(),
    pips: nullableNum,
    pnlJpy: nullableNum,
    rMultiple: nullableNum,
    confidence: nullableNum,
    rationaleMemo: nullableStr,
    slReason: nullableStr,
    tpReason: nullableStr,
    insight: nullableStr,
    nextRule: nullableStr,
    tags: z.array(z.string()),
    ruleChecks: z.array(
      z.object({ rule: z.string(), result: z.string() }).strict(),
    ),
    charts: z
      .object({
        "1m": nullableStr,
        "15m": nullableStr,
        "1h": nullableStr,
      })
      .strict(),
  })
  .strict();
export type TradeBundle = z.infer<typeof tradeBundleSchema>;

export const daySummarySchema = z
  .object({
    tradeCount: z.number().int(),
    closedCount: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    winRatePct: nullableNum,
    totalPips: nullableNum,
    totalPnlJpy: nullableNum,
    avgR: nullableNum,
    ruleDeviationCount: z.number().int(),
  })
  .strict();
export type DaySummary = z.infer<typeof daySummarySchema>;

export const dayBundleSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    date: dateStr,
    timezone: z.string(),
    summary: daySummarySchema,
    trades: z.array(tradeBundleSchema),
  })
  .strict();
export type DayBundle = z.infer<typeof dayBundleSchema>;

/** 画像を作る時間足（契約の charts のキー） */
export const CHART_TFS = ["1m", "15m", "1h"] as const;
export type ChartTf = (typeof CHART_TFS)[number];
