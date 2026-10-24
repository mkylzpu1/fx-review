import type { Summary } from "../types";

/** この連敗数に達したら警告する */
export const LOSS_STREAK_WARN = 3;
const LIMIT_KEY = "fx-review:daily-loss-limit-pct";

export type TodayWarning =
  | { kind: "daily_loss"; lossPct: number; limitPct: number }
  | { kind: "loss_streak"; streak: number };

/** 日次損失の上限（口座残高に対する%）。未設定は null。ブラウザに保存する */
export function loadDailyLossLimit(): number | null {
  try {
    const v = Number(localStorage.getItem(LIMIT_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveDailyLossLimit(pct: number | null): void {
  try {
    if (pct === null) localStorage.removeItem(LIMIT_KEY);
    else localStorage.setItem(LIMIT_KEY, String(pct));
  } catch {
    // 保存できなくても動作は続ける
  }
}

/** 今日の損益・連敗から警告を作る。上限未設定なら日次損失の警告は出さない */
export function todayWarnings(
  s: Summary,
  balanceJpy: number,
  limitPct: number | null,
): TodayWarning[] {
  const out: TodayWarning[] = [];
  if (limitPct !== null && balanceJpy > 0 && s.totalPnlJpy < 0) {
    const lossPct = (-s.totalPnlJpy / balanceJpy) * 100;
    if (lossPct >= limitPct) {
      out.push({
        kind: "daily_loss",
        lossPct: Math.round(lossPct * 100) / 100,
        limitPct,
      });
    }
  }
  if (s.maxLossStreak >= LOSS_STREAK_WARN) {
    out.push({ kind: "loss_streak", streak: s.maxLossStreak });
  }
  return out;
}
