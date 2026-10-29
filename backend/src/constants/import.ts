/** CSV取り込みの重複判定まわりの定数（手入力との照合の基準。感覚に合わなければここだけを直す） */

/**
 * 手入力のトレードと「同じ取引」とみなすエントリー時刻の差（分）。
 * 手入力は分単位で、約定時刻と少しずれることがあるため、幅を持たせている
 */
export const MANUAL_MATCH_TIME_MINUTES = 30;

/** 同じ取引とみなすエントリー価格の差（円。0.05 = USDJPY で5 pips） */
export const MANUAL_MATCH_PRICE_YEN = 0.05;
