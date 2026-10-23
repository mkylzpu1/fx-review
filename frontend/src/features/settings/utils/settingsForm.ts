import type { AccountSettings } from "../types";

export type SettingsErrors = Partial<
  Record<
    | "balanceJpy"
    | "maxRiskPct"
    | "minRr"
    | "chartBarsBefore"
    | "chartBarsAfter"
    | "ema",
    string
  >
>;

/** 設定フォームの検証（バックエンドの検証と同じ条件） */
export function validateSettings(s: AccountSettings): SettingsErrors {
  const e: SettingsErrors = {};
  if (!Number.isInteger(s.balanceJpy) || s.balanceJpy <= 0) {
    e.balanceJpy = "口座残高は1円以上の整数で入力してください";
  }
  if (!(s.maxRiskPct > 0 && s.maxRiskPct <= 100)) {
    e.maxRiskPct = "0より大きく100以下で入力してください";
  }
  if (!(s.minRr > 0)) e.minRr = "0より大きい値を入力してください";
  if (!Number.isInteger(s.chartBarsBefore) || s.chartBarsBefore < 1) {
    e.chartBarsBefore = "1以上の整数で入力してください";
  }
  if (!Number.isInteger(s.chartBarsAfter) || s.chartBarsAfter < 1) {
    e.chartBarsAfter = "1以上の整数で入力してください";
  }
  const periods = s.emaSettings.map((x) => x.period);
  if (periods.some((p) => !Number.isInteger(p) || p < 1)) {
    e.ema = "EMAの期間は1以上の整数で入力してください";
  } else if (new Set(periods).size !== periods.length) {
    e.ema = "EMAの期間が重複しています";
  }
  return e;
}

/** 「= ¥7,500 まで」の金額（1トレードで許容する損失） */
export function maxRiskYen(balanceJpy: number, maxRiskPct: number): number {
  return Math.floor((balanceJpy * maxRiskPct) / 100);
}

export function isSameSettings(
  a: AccountSettings,
  b: AccountSettings,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
