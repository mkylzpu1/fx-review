/** 円表示（例: ¥7,500）。3桁区切り */
export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 符号つき数値（例: +38.0 / −12.5 / 0.0）。損益の色だけに頼らない */
function signed(v: number, digits: number): string {
  const body = Math.abs(v).toFixed(digits);
  if (v > 0) return `+${body}`;
  if (v < 0) return `−${body}`;
  return body;
}

export const formatPips = (v: number | null) =>
  v === null ? "—" : `${signed(v, 1)} pips`;
/** 単位なしのpips（一覧の列見出しに「pips」がある場合用） */
export const formatPipsValue = (v: number | null) =>
  v === null ? "—" : signed(v, 1);
export const formatR = (v: number | null) =>
  v === null ? "—" : `${signed(v, 2)}R`;
export const formatYenSigned = (v: number | null) =>
  v === null
    ? "—"
    : `${v < 0 ? "−" : v > 0 ? "+" : ""}¥${Math.abs(Math.round(v)).toLocaleString("ja-JP")}`;

/** 価格の小数桁はpip幅に合わせる（0.01 → 3桁） */
export function priceDigits(pipSize: number): number {
  return Math.max(0, Math.round(-Math.log10(pipSize))) + 1;
}
export const formatPrice = (v: number | null, pipSize = 0.01) =>
  v === null ? "—" : v.toFixed(priceDigits(pipSize));

/** ISO → JST表記（例: 2026/10/21 21:35） */
export function formatJst(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(Date.parse(iso) + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** ISO → <input type="datetime-local"> の値（JST） */
export function isoToJstInput(iso: string | null): string {
  if (!iso) return "";
  return formatJst(iso).replace(/\//g, "-").replace(" ", "T");
}

/** <input type="datetime-local"> の値（JST）→ ISO（オフセット付き） */
export function jstInputToIso(v: string): string | null {
  return v ? `${v}:00+09:00` : null;
}

/** 保有時間（分）→ 「2時間13分」 */
export function formatHold(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export const SIDE_LABEL = { buy: "買い", sell: "売り" } as const;
