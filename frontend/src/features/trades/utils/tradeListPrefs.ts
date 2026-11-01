import type { PeriodKey } from "@/features/stats/types";
import type { TradeSort } from "../types";

/**
 * トレード一覧（/trades）の絞り込み・並び順の保存。
 * 一覧画面と、編集画面の「保存して次のトレードへ」が同じ条件を読めるように、ここに置く。
 */
export type ResultTab = "all" | "win" | "loss";

export const DEFAULT_PERIOD: PeriodKey = "month";
/** 一覧の期間ボタンの並び（統計画面の並びとは別） */
export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "today", label: "今日" },
  { value: "month", label: "今月" },
  { value: "30d", label: "過去30日" },
  { value: "90d", label: "過去90日" },
];
export const PERIOD_KEY = "fx-review:trade-list-period";
/** 前回選んだ期間。無い・不正な値・読み出せないときは初期値（今月） */
export const loadPeriod = (): PeriodKey => {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return PERIOD_OPTIONS.some((o) => o.value === v)
      ? (v as PeriodKey)
      : DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
};

/** 期間を日付で指定したとき（YYYY-MM-DD・日本時間）。どちらか入っていれば期間ボタンより優先する */
export const DATE_FROM_KEY = "fx-review:trade-list-date-from";
export const DATE_TO_KEY = "fx-review:trade-list-date-to";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** YYYY-MM-DD として実在する日付か（2月30日などは不可） */
export const isValidDateStr = (v: string): boolean => {
  if (!DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  );
};
const jstMidnightMs = (v: string): number => {
  const [y, m, d] = v.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - JST_OFFSET_MS;
};
/** 日付指定 → API の from / to（ISO）。from は当日0時、to は当日の最後（含む）。どちらも日本時間 */
export function dateRangeToIso(
  dateFrom: string,
  dateTo: string,
): { from?: string; to?: string } {
  return {
    from: isValidDateStr(dateFrom)
      ? new Date(jstMidnightMs(dateFrom)).toISOString()
      : undefined,
    to: isValidDateStr(dateTo)
      ? new Date(jstMidnightMs(dateTo) + DAY_MS - 1).toISOString()
      : undefined,
  };
}
/** 前回入れた日付。無い・不正な値は空（指定なし） */
export const loadDateFrom = (): string => {
  const v = readStored(DATE_FROM_KEY) ?? "";
  return isValidDateStr(v) ? v : "";
};
export const loadDateTo = (): string => {
  const v = readStored(DATE_TO_KEY) ?? "";
  return isValidDateStr(v) ? v : "";
};

export const TABS: {
  value: ResultTab;
  label: string;
  tone?: "profit" | "loss";
}[] = [
  { value: "all", label: "すべて" },
  { value: "win", label: "勝ち", tone: "profit" },
  { value: "loss", label: "負け", tone: "loss" },
];
export const SORTS: { value: TradeSort; label: string }[] = [
  { value: "entry_desc", label: "新しい順" },
  { value: "entry_asc", label: "古い順" },
  { value: "pnl_desc", label: "損益が大きい順" },
  { value: "pnl_asc", label: "損益が小さい順" },
];
export const TAB_KEY = "fx-review:trade-list-result";
export const DEVIATION_KEY = "fx-review:trade-list-deviation";
export const PAIR_KEY = "fx-review:trade-list-pair";
export const SORT_KEY = "fx-review:trade-list-sort";
export const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const writeStored = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 保存できなくても表示には影響しない */
  }
};
/** 前回選んだ結果タブ。無い・不正な値は「すべて」 */
export const loadTab = (): ResultTab => {
  const v = readStored(TAB_KEY);
  return TABS.some((o) => o.value === v) ? (v as ResultTab) : "all";
};
export const loadDeviation = (): boolean => readStored(DEVIATION_KEY) === "1";
/** ペアは設定から消えている場合があるので、ここでは文字列のまま読み、画面側で存在を確かめる */
export const loadPair = (): string => readStored(PAIR_KEY) ?? "";
export const loadSort = (): TradeSort => {
  const v = readStored(SORT_KEY);
  return SORTS.some((o) => o.value === v) ? (v as TradeSort) : "entry_desc";
};

/** 前回の一覧の絞り込み・並び順をまとめて読む（一覧画面の初期値と同じ検証） */
export function loadListPrefs() {
  return {
    period: loadPeriod(),
    tab: loadTab(),
    deviationOnly: loadDeviation(),
    pair: loadPair(),
    sort: loadSort(),
    dateFrom: loadDateFrom(),
    dateTo: loadDateTo(),
  };
}
