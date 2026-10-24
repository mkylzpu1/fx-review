/** チャート上の2点（価格と、足の位置）から、pips・本数・時間を求める */
export interface MeasurePoint {
  price: number;
  /** 時間軸上の位置（足の番号。小数でもよい） */
  logical: number;
  /** 時刻（UTC秒） */
  timeSec: number;
}

export interface Measurement {
  /** B − A の価格差（pips）。上に動けばプラス */
  pips: number;
  /** A〜B の足の本数 */
  bars: number;
  /** A〜B の時間（秒、0以上） */
  seconds: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function measure(
  a: MeasurePoint,
  b: MeasurePoint,
  pipSize: number,
): Measurement {
  return {
    // -0 を出さない
    pips: round1((b.price - a.price) / pipSize) + 0,
    bars: Math.round(Math.abs(b.logical - a.logical)),
    seconds: Math.abs(b.timeSec - a.timeSec),
  };
}

/** 秒 → 「2時間13分」「45分」「3日4時間」。1分未満は「0分」 */
export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `${d}日${h}時間` : `${d}日`;
  if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  return `${m}分`;
}
