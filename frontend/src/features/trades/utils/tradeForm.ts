import { isoToJstInput, jstInputToIso } from "@/utils/format";
import { validatePlan } from "@/utils/tradeCalc";
import type {
  ExitMethod,
  RuleResult,
  Side,
  Trade,
  TradePayload,
} from "../types";

/** 画面の入力状態。数値は入力途中の文字列のまま持つ */
export interface TradeFormState {
  pair: string;
  side: Side;
  lots: string;
  entryAt: string; // datetime-local（JST）
  entryPrice: string;
  slPrice: string;
  tpPrice: string;
  slReason: string;
  tpReason: string;
  rationaleMemo: string;
  confidence: number | null;
  exitAt: string;
  exitPrice: string;
  exitMethod: Exclude<ExitMethod, "open"> | "";
  insight: string;
  nextRule: string;
  tagIds: string[];
  /** 手動ルールのチェック（未チェックは持たない） */
  ruleChecks: Record<string, RuleResult>;
}

export type FormErrors = Partial<
  Record<
    | "pair"
    | "lots"
    | "entryAt"
    | "entryPrice"
    | "slPrice"
    | "tpPrice"
    | "exitAt"
    | "exitPrice",
    string
  >
>;

export function emptyForm(pair: string, nowJst: string): TradeFormState {
  return {
    pair,
    side: "buy",
    lots: "",
    entryAt: nowJst,
    entryPrice: "",
    slPrice: "",
    tpPrice: "",
    slReason: "",
    tpReason: "",
    rationaleMemo: "",
    confidence: null,
    exitAt: "",
    exitPrice: "",
    exitMethod: "",
    insight: "",
    nextRule: "",
    tagIds: [],
    ruleChecks: {},
  };
}

const str = (v: number | null) => (v === null ? "" : String(v));

export function fromTrade(t: Trade): TradeFormState {
  return {
    pair: t.pair,
    side: t.side,
    lots: String(t.lots),
    entryAt: isoToJstInput(t.entryAt),
    entryPrice: String(t.entryPrice),
    slPrice: str(t.slPrice),
    tpPrice: str(t.tpPrice),
    slReason: t.slReason ?? "",
    tpReason: t.tpReason ?? "",
    rationaleMemo: t.rationaleMemo ?? "",
    confidence: t.confidence,
    exitAt: isoToJstInput(t.exitAt),
    exitPrice: str(t.exitPrice),
    exitMethod: t.exitMethod === "open" ? "" : t.exitMethod,
    insight: t.insight ?? "",
    nextRule: t.nextRule ?? "",
    tagIds: t.tags.map((x) => x.id),
    ruleChecks: Object.fromEntries(
      t.ruleChecks.map((c) => [c.ruleId, c.result]),
    ),
  };
}

/** 空欄は null、数値でなければ NaN */
export function parseNum(s: string): number | null {
  const v = s.trim();
  if (v === "") return null;
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

/** 入力の検証（SL・TP・根拠などは任意。入力されたものだけ確認する） */
export function validateForm(s: TradeFormState): FormErrors {
  const e: FormErrors = {};
  const lots = parseNum(s.lots);
  const entry = parseNum(s.entryPrice);
  const sl = parseNum(s.slPrice);
  const tp = parseNum(s.tpPrice);
  const exit = parseNum(s.exitPrice);

  if (!s.pair) e.pair = "通貨ペアを選択してください";
  if (lots === null) e.lots = "ロットを入力してください";
  else if (Number.isNaN(lots) || lots <= 0)
    e.lots = "ロットは0より大きい数値で入力してください";
  else if (Math.abs(lots * 100 - Math.round(lots * 100)) > 1e-9)
    e.lots = "ロットは小数第2位までです";
  if (!s.entryAt) e.entryAt = "エントリー日時を入力してください";
  if (entry === null) e.entryPrice = "エントリー価格を入力してください";
  else if (Number.isNaN(entry) || entry <= 0)
    e.entryPrice = "価格は0より大きい数値で入力してください";
  if (Number.isNaN(sl)) e.slPrice = "数値で入力してください";
  if (Number.isNaN(tp)) e.tpPrice = "数値で入力してください";

  if (entry !== null && !Number.isNaN(entry) && !e.slPrice && !e.tpPrice) {
    const plan = validatePlan(s.side, entry, sl, tp);
    if (plan.sl) e.slPrice = plan.sl;
    if (plan.tp) e.tpPrice = plan.tp;
  }

  if (Number.isNaN(exit) || (exit !== null && exit <= 0))
    e.exitPrice = "価格は0より大きい数値で入力してください";
  else if (s.exitAt && exit === null)
    e.exitPrice = "決済価格を入力してください";
  else if (!s.exitAt && exit !== null) e.exitAt = "決済日時を入力してください";
  if (s.exitAt && s.entryAt && s.exitAt < s.entryAt)
    e.exitAt = "決済日時はエントリー日時より後にしてください";
  return e;
}

const orNull = (s: string) => s.trim() || null;

/** 検証を通ったフォーム状態から API ボディを作る */
export function toPayload(s: TradeFormState, draft: boolean): TradePayload {
  return {
    pair: s.pair,
    side: s.side,
    lots: Number(s.lots),
    entryAt: jstInputToIso(s.entryAt) as string,
    entryPrice: Number(s.entryPrice),
    slPrice: parseNum(s.slPrice),
    tpPrice: parseNum(s.tpPrice),
    slReason: orNull(s.slReason),
    tpReason: orNull(s.tpReason),
    rationaleMemo: orNull(s.rationaleMemo),
    confidence: s.confidence,
    exitAt: jstInputToIso(s.exitAt),
    exitPrice: parseNum(s.exitPrice),
    exitMethod: s.exitAt ? s.exitMethod || null : null,
    insight: orNull(s.insight),
    nextRule: orNull(s.nextRule),
    draft,
    tagIds: s.tagIds,
    ruleChecks: Object.entries(s.ruleChecks).map(([ruleId, result]) => ({
      ruleId,
      result,
    })),
  };
}

export const isDirty = (a: TradeFormState, b: TradeFormState) =>
  JSON.stringify(a) !== JSON.stringify(b);
