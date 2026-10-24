/** チャートに重ねて表示するものの、表示・非表示（凡例のトグルで切り替える） */
export interface ChartOverlays {
  entryLine: boolean;
  tpLine: boolean;
  slLine: boolean;
  /** エントリーから決済までを結ぶ線 */
  path: boolean;
  /** IN / OUT の矢印 */
  markers: boolean;
}

export const DEFAULT_OVERLAYS: ChartOverlays = {
  entryLine: true,
  tpLine: true,
  slLine: true,
  path: true,
  markers: true,
};

/** 時間足を切り替えたとき、最初に見せる足の本数（どの時間足でも同じ）。エントリーの足を、左から60本目に置く */
export const INITIAL_BARS_BEFORE = 60;
export const INITIAL_BARS_AFTER = 40;
