/**
 * エクスポート本文の組み立て（純粋関数）。未入力の列は空欄で出し、
 * 冒頭の集計に「SL入力あり n件 / 全 N件」などを載せて、AIが「データが少ない」前提で分析できるようにする（§9.7）。
 */
import type { Rule, TradeView } from "../../types/trade";
import { buildStats } from "../stats/statsBuilder";
import { hourInZone, sessionOf } from "../stats/statsCalc";
import { toCsv, type ExportContext, type Include } from "./exportColumns";
import { RANGE_LABEL, type ExportRange } from "./exportRange";
import { EXPORT_TEXT } from "./exportText";

export type ExportFormat = "markdown" | "csv" | "json";

export interface ExportInput {
  views: TradeView[];
  rules: Rule[];
  maxRiskPct: number;
  minRr: number;
  timezone: string;
  range: ExportRange;
  format: ExportFormat;
  include: Include;
  now: Date;
}

export interface ExportOutput {
  content: string;
  filename: string;
  mime: string;
  tradeCount: number;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function makeContext(timezone: string): ExportContext {
  const parts = (iso: string) => {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(new Date(iso));
    const g = (t: string) => f.find((x) => x.type === t)?.value ?? "";
    return g;
  };
  return {
    timezone,
    formatDate: (iso) => {
      const g = parts(iso);
      return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
    },
    marketOf: (iso) => {
      const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        parts(iso)("weekday"),
      );
      return {
        weekday: WEEKDAYS[idx] ?? "",
        session: sessionOf(hourInZone(iso, timezone)).label,
      };
    },
  };
}

const num = (v: number | null, d = 2) => (v === null ? "—" : v.toFixed(d));

function rulesSection(i: ExportInput): string[] {
  const active = i.rules.filter((r) => r.isActive);
  const lines = [EXPORT_TEXT.rulesHeading, ""];
  if (active.length === 0) lines.push("- （有効なルールはありません）");
  for (const r of active) {
    lines.push(`- ${r.title}${r.description ? `: ${r.description}` : ""}`);
  }
  lines.push(
    `- 1トレードの最大リスク: 口座の ${i.maxRiskPct}%`,
    `- 最低リスクリワード: ${i.minRr}`,
  );
  return lines;
}

function summarySection(i: ExportInput): string[] {
  const stats = buildStats(i.views, i.timezone);
  const s = stats.summary;
  const all = i.views.length;
  const withSl = i.views.filter((v) => v.slPrice !== null).length;
  const withTp = i.views.filter((v) => v.tpPrice !== null).length;
  const withRationale = i.views.filter((v) =>
    v.tags.some((t) => t.kind === "rationale"),
  ).length;
  const ngByRule = i.rules
    .map((r) => ({
      title: r.title,
      n: i.views.filter((v) =>
        v.ruleResults.some((x) => x.ruleId === r.id && x.result === "ng"),
      ).length,
    }))
    .filter((x) => x.n > 0);
  const lines = [
    EXPORT_TEXT.summaryHeading,
    "",
    `- 期間: ${RANGE_LABEL[i.range]} / 全 ${all}件（決済済みで集計 n=${s.n}）`,
    `- 勝率: ${s.winRate === null ? "—" : `${s.winRate.toFixed(1)}%`} / PF: ${num(s.profitFactor)} / 平均R: ${num(s.avgR)} / 最大連敗: ${s.maxLossStreak}`,
    `- 合計pips: ${s.totalPips.toFixed(1)} / 合計損益: ${s.totalPnlJpy}円`,
    `- R が計算できたのは ${s.rCount}件（R未計算 ${s.rMissing}件）。R系の集計はこの ${s.rCount}件だけです`,
    `- SL入力あり ${withSl}件 / 全 ${all}件、TP入力あり ${withTp}件、根拠タグあり ${withRationale}件`,
  ];
  if (ngByRule.length === 0) {
    lines.push("- ルール逸脱の記録: なし");
  } else {
    lines.push(
      `- ルール逸脱の記録: ${ngByRule.map((x) => `${x.title} ${x.n}件`).join("、")}`,
    );
  }
  return lines;
}

export function buildExport(i: ExportInput): ExportOutput {
  const ctx = makeContext(i.timezone);
  const stamp = ctx.formatDate(i.now.toISOString()).slice(0, 10);
  const base = { tradeCount: i.views.length };

  if (i.format === "csv") {
    return {
      ...base,
      content: toCsv(i.views, i.include, ctx),
      filename: `fx-review-trades-${stamp}.csv`,
      mime: "text/csv",
    };
  }

  if (i.format === "json") {
    const content = JSON.stringify(
      {
        exportedAt: i.now.toISOString(),
        range: i.range,
        summary: buildStats(i.views, i.timezone).summary,
        rules: i.rules,
        trades: i.views,
      },
      null,
      2,
    );
    return {
      ...base,
      content,
      filename: `fx-review-${stamp}.json`,
      mime: "application/json",
    };
  }

  const md = [
    EXPORT_TEXT.title,
    "",
    ...EXPORT_TEXT.request,
    "",
    ...rulesSection(i),
    "",
    ...summarySection(i),
    "",
    EXPORT_TEXT.tradesHeading,
    "",
    "```csv",
    toCsv(i.views, i.include, ctx),
    "```",
    "",
    EXPORT_TEXT.askHeading,
    "",
    ...EXPORT_TEXT.asks.map((a, n) => `${n + 1}. ${a}`),
  ].join("\n");
  return {
    ...base,
    content: md,
    filename: `fx-review-${stamp}.md`,
    mime: "text/markdown",
  };
}
