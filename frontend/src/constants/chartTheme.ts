/**
 * チャートの色。lightweight-charts は Tailwind のクラスを使えないため、
 * tailwind.config.ts のデザイントークンと同じ値をここ1か所に置く。
 */
export const CHART_COLORS = {
  background: "#161B22",
  grid: "#262D38",
  text: "#B4BDCA",
  up: "#6EE7C8",
  down: "#FF7A8A",
  entry: "#9DB4FF",
  sl: "#FF7A8A",
  tp: "#6EE7C8",
} as const;

/** EMAの線の色（追加した順に割り当てる） */
export const EMA_COLORS = [
  "#F5B94A",
  "#9DB4FF",
  "#C792EA",
  "#6EE7C8",
  "#FF9E64",
  "#7DCFFF",
  "#E0AF68",
  "#BB9AF7",
] as const;

/** 表示は日本時間。チャートはUTC秒をそのまま時刻軸にするため、9時間ずらして渡す */
export const JST_OFFSET_SEC = 9 * 60 * 60;
