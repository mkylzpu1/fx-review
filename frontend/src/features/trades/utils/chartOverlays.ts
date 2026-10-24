/** チャートに重ねて表示するものの、表示・非表示（凡例のトグルで切り替える） */
export interface ChartOverlays {
  entryLine: boolean;
  tpLine: boolean;
  slLine: boolean;
  /** 決済価格の点線（端から端まで） */
  exitLine: boolean;
  /** エントリー以降の足の背景色（どこからが「エントリー後」かを示す） */
  afterShade: boolean;
  /** IN / OUT の矢印 */
  markers: boolean;
  /** 保有中の最大含み益・最大含み損と、決済後の最大到達の水準線 */
  excursion: boolean;
}

export const DEFAULT_OVERLAYS: ChartOverlays = {
  entryLine: true,
  tpLine: true,
  slLine: true,
  exitLine: true,
  afterShade: true,
  markers: true,
  excursion: false,
};

/** 時間足を切り替えたとき、最初に見せる足の本数（どの時間足でも同じ）。エントリーの足を、左から60本目に置く */
export const INITIAL_BARS_BEFORE = 60;
export const INITIAL_BARS_AFTER = 40;
