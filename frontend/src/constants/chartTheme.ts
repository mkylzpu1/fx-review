/**
 * チャートの色。lightweight-charts は Tailwind のクラスを使えないため、
 * tailwind.config.ts のデザイントークンと同じ値をここ1か所に置く。
 */
export const CHART_COLORS = {
  background: "#161B22",
  grid: "#2A4A3C",
  text: "#B4BDCA",
  up: "#6EE7C8",
  down: "#FF7A8A",
  entry: "#D5DBE4",
  sl: "#FF7A8A",
  tp: "#6EE7C8",
  exit: "#F5B94A",
} as const;

/** 売買の向きの色（買い=緑・売り=赤。SL/TPの色よりはっきり濃くして見分ける）。SL/TP/決済の色と区別する。文字（買い・売り）も必ず併記する */
export const SIDE_COLORS = {
  buy: "#4ADE80",
  sell: "#FF5C72",
} as const;

export const SIDE_LABEL_JA = { buy: "買い", sell: "売り" } as const;

/** EMAの線の色（追加した順に割り当てる） */
export const EMA_COLORS = [
  "#F5B94A",
  "#E6EAF0",
  "#FF8FA3",
  "#6EE7C8",
  "#FF9E64",
  "#FFD6A5",
  "#E0AF68",
  "#8FF0D8",
] as const;

/** 表示は日本時間。チャートはUTC秒をそのまま時刻軸にするため、9時間ずらして渡す */
export const JST_OFFSET_SEC = 9 * 60 * 60;
