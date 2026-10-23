/** 設定まわりの共通型（store / service / handler で共有） */

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface EmaSetting {
  period: number;
  visible: boolean;
}

export interface AccountSettings {
  balanceJpy: number;
  maxRiskPct: number;
  minRr: number;
  timezone: string;
  chartDefaultTf: Timeframe;
  chartBarsBefore: number;
  chartBarsAfter: number;
  emaSettings: EmaSetting[];
}

/** 更新用（すべて任意） */
export type AccountSettingsPatch = Partial<AccountSettings>;

export interface CurrencyPair {
  id: string;
  symbol: string;
  pipSize: number;
  pipValueJpyPerLot: number;
  showInPicker: boolean;
}

export type TagKind = "rationale" | "emotion";

export interface Tag {
  id: string;
  kind: TagKind;
  name: string;
  sortOrder: number;
}
