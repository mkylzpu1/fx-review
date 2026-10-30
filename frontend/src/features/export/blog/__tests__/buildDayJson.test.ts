import { describe, expect, it } from "vitest";
import { dayBundleSchema, manifestSchema } from "../bundleSchema";
import {
  buildDayBundles,
  buildManifest,
  chartRelPath,
  summarizeDay,
  toJson,
  type ChartOutcomes,
} from "../buildDayJson";
import { makeTrade } from "./fixtures";

const opts = {
  timeZone: "Asia/Tokyo",
  from: "2026-10-29",
  to: "2026-10-29",
  includeOpen: false,
};

describe("seq の採番", () => {
  it("その日のエントリー時刻の昇順で1始まり", () => {
    const late = makeTrade({ entryAt: "2026-10-29T05:00:00Z" });
    const early = makeTrade({ entryAt: "2026-10-29T01:00:00Z" });
    const { days } = buildDayBundles([late, early], opts);
    expect(days[0].trades.map((t) => [t.seq, t.entryAt])).toEqual([
      [1, early.entryAt],
      [2, late.entryAt],
    ]);
  });
  it("日が変わると1に戻る", () => {
    const a = makeTrade({ entryAt: "2026-10-28T20:00:00Z" }); // JST 10/29
    const b = makeTrade({ entryAt: "2026-10-29T20:00:00Z" }); // JST 10/30
    const { days } = buildDayBundles([a, b], { ...opts, to: "2026-10-30" });
    expect(days.map((d) => d.trades.map((t) => t.seq))).toEqual([[1], [1]]);
  });
});

describe("スキーマ適合", () => {
  it("day.json と manifest.json が zod に通る", () => {
    const built = buildDayBundles([makeTrade(), makeTrade({ pips: -5 })], opts);
    for (const d of built.days)
      expect(() => dayBundleSchema.parse(d)).not.toThrow();
    const m = buildManifest(built, {
      ...opts,
      generatedAt: new Date("2026-10-30T03:00:00Z"),
    });
    expect(manifestSchema.parse(m).generatedAt).toBe(
      "2026-10-30T03:00:00.000Z",
    );
    expect(m.days).toEqual(["2026-10-29"]);
  });
  it("欠損は null で出し、キーは省略しない", () => {
    const t = makeTrade({
      slPrice: null,
      tpPrice: null,
      rationaleMemo: null,
      insight: null,
      confidence: null,
    });
    const out = buildDayBundles([t], opts).days[0].trades[0];
    expect(out).toMatchObject({
      slPrice: null,
      tpPrice: null,
      rationaleMemo: null,
      insight: null,
      confidence: null,
      charts: { "1m": null, "15m": null, "1h": null },
    });
    expect("slPrice" in out).toBe(true);
  });
  it("ローカル時刻はJST、数値は丸めない", () => {
    const t = makeTrade({ entryPrice: 150.123456, pips: 12.3456789 });
    const out = buildDayBundles([t], opts).days[0].trades[0];
    expect(out.entryAtLocal).toBe("2026-10-29 10:00");
    expect(out.entryPrice).toBe(150.123456);
    expect(out.pips).toBe(12.3456789);
  });
  it("ruleChecks は表示名と既存の結果値、tags は名前", () => {
    const out = buildDayBundles([makeTrade()], opts).days[0].trades[0];
    expect(out.ruleChecks).toEqual([{ rule: "SLを置く", result: "ok" }]);
    expect(out.tags).toEqual(["押し目"]);
  });
});

describe("禁止項目", () => {
  it("ID・取り込み元・残高・メール・リスク額が出力に含まれない", () => {
    const t = makeTrade();
    const built = buildDayBundles([t], opts);
    const text = toJson(built.days[0]) + toJson(buildManifest(built, opts));
    expect(text).not.toContain(t.id);
    expect(text).not.toContain("rakuten");
    expect(text).not.toContain("tag-1");
    expect(text).not.toContain("rule-1");
    for (const key of [
      "balance",
      "email",
      "userId",
      '"id"',
      "source",
      "riskJpy",
      "riskPct",
    ])
      expect(text).not.toContain(key);
  });
  it("契約にない項目が混ざるとスキーマで落ちる", () => {
    const d = buildDayBundles([makeTrade()], opts).days[0];
    const bad = { ...d, trades: [{ ...d.trades[0], id: "x" }] };
    expect(() => dayBundleSchema.parse(bad)).toThrow();
  });
});

describe("警告", () => {
  it("memo_missing（空白だけも未入力）と open_trade", () => {
    const noMemo = makeTrade({
      rationaleMemo: "  ",
      entryAt: "2026-10-29T01:00:00Z",
    });
    const open = makeTrade({
      status: "open",
      exitAt: null,
      exitPrice: null,
      entryAt: "2026-10-29T02:00:00Z",
    });
    const { warnings } = buildDayBundles([noMemo, open], {
      ...opts,
      includeOpen: true,
    });
    expect(warnings).toEqual([
      expect.objectContaining({
        seq: 1,
        code: "memo_missing",
        date: "2026-10-29",
      }),
      expect.objectContaining({ seq: 2, code: "open_trade" }),
    ]);
  });
  it("candles_missing / image_failed は画像の結果から作り、パスは null", () => {
    const t = makeTrade();
    const charts: ChartOutcomes = new Map([
      [
        t.id,
        {
          "1m": { path: chartRelPath(1, t.pair, "1m") },
          "15m": { path: null, reason: "candles_missing" },
          "1h": { path: null, reason: "image_failed", detail: "timeout" },
        },
      ],
    ]);
    const built = buildDayBundles([t], { ...opts, charts });
    expect(built.days[0].trades[0].charts).toEqual({
      "1m": "charts/01_USDJPY_1m.png",
      "15m": null,
      "1h": null,
    });
    expect(built.warnings.map((w) => w.code)).toEqual([
      "candles_missing",
      "image_failed",
    ]);
  });
});

describe("summarizeDay", () => {
  it("勝ち負け・合計・平均R。丸めない。決済済みが無ければ null", () => {
    const s = summarizeDay([
      makeTrade({ pips: 10, pnlJpy: 1000, rMultiple: 1 }),
      makeTrade({ pips: -5, pnlJpy: -500, rMultiple: -0.5, deviation: true }),
      makeTrade({ pips: 1, pnlJpy: 100, rMultiple: 0.1 }),
    ]);
    expect(s).toMatchObject({
      tradeCount: 3,
      closedCount: 3,
      wins: 2,
      losses: 1,
      totalPips: 6,
      totalPnlJpy: 600,
      ruleDeviationCount: 1,
    });
    expect(s.winRatePct).toBeCloseTo(66.6666667, 5);
    expect(s.avgR).toBeCloseTo(0.2, 10);
    expect(
      summarizeDay([makeTrade({ status: "open", pips: null })]),
    ).toMatchObject({
      closedCount: 0,
      winRatePct: null,
      totalPips: null,
      totalPnlJpy: null,
      avgR: null,
    });
  });
});

describe("toJson", () => {
  it("2スペース・LF・末尾改行", () => {
    expect(toJson({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
    expect(toJson({ a: "あ" })).not.toContain("\\u");
  });
});
