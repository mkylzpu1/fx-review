/** 円表示（例: ¥7,500）。3桁区切り */
export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}
