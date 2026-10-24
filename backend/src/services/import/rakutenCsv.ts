import type {
  ExecutionRow,
  ImportFileResult,
  ImportRowError,
} from "../../types/import";

/** 取り込みに必要な列。無いファイルは別形式としてファイル単位でエラーにする */
export const REQUIRED_COLUMNS = [
  "約定No.",
  "通貨ペア",
  "注文区分",
  "売買",
  "約定数量",
  "約定レート",
  "取引損益（円換算）",
  "約定日時",
] as const;

/** 楽天の表記 → 内部の通貨ペア。USDJPYのみ対応（指示書 §1） */
const PAIR_MAP: Record<string, string> = { "ドル/円": "USDJPY" };

/** RFC4180相当の最小CSVパーサー（引用符・"" のエスケープ・CRLF・BOM に対応） */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let touched = false;

  const endField = () => {
    row.push(field);
    field = "";
    touched = true;
  };
  const endRow = () => {
    if (touched || field !== "") {
      endField();
      rows.push(row);
    }
    row = [];
    touched = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
      touched = true;
    } else if (ch === ",") endField();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  endRow();
  return rows;
}

/** `YYYY/MM/DD HH:mm`（JST・秒なし）→ UTCのISO文字列。不正なら null */
export function parseJstDateTime(v: string): string | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h - 9, mi);
  const back = new Date(ms + 9 * 3600 * 1000);
  // 2/30 のような存在しない日付を弾く
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d ||
    back.getUTCHours() !== h ||
    h > 23 ||
    mi > 59
  )
    return null;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const toNumber = (v: string): number | null => {
  const s = v.replace(/[,\s+]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export interface ParsedFile {
  file: ImportFileResult;
  rows: ExecutionRow[];
  errors: ImportRowError[];
}

/** 1ファイル分のテキストを約定行にする。形式が違えば file.status = "error" */
export function parseRakutenFile(name: string, text: string): ParsedFile {
  const fail = (message: string): ParsedFile => ({
    file: { name, status: "error", rowCount: 0, message },
    rows: [],
    errors: [],
  });

  const table = parseCsv(text);
  if (table.length === 0) return fail("ファイルが空です");
  const header = table[0].map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0)
    return fail(
      `${missing.join("・")}の列がありません。楽天FX証券の約定履歴CSV（Shift_JIS）か確認してください。`,
    );
  const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<
    string,
    number
  >;

  const rows: ExecutionRow[] = [];
  const errors: ImportRowError[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof REQUIRED_COLUMNS)[number]) =>
      (cells[idx[c]] ?? "").trim();
    const no = get("約定No.");
    const err = (message: string) =>
      errors.push({ file: name, line, executionNo: no || null, message });

    const pair = PAIR_MAP[get("通貨ペア")];
    if (!pair) return err(`対応していない通貨ペアです（${get("通貨ペア")}）`);
    const kind =
      get("注文区分") === "新規"
        ? "open"
        : get("注文区分") === "決済"
          ? "close"
          : null;
    if (!kind) return err(`注文区分を判別できません（${get("注文区分")}）`);
    const side =
      get("売買") === "買" ? "buy" : get("売買") === "売" ? "sell" : null;
    if (!side) return err(`売買を判別できません（${get("売買")}）`);
    const quantity = toNumber(get("約定数量"));
    const rate = toNumber(get("約定レート"));
    const executedAt = parseJstDateTime(get("約定日時"));
    if (!no) return err("約定No.がありません");
    if (quantity === null || quantity <= 0) return err("約定数量が不正です");
    if (rate === null || rate <= 0) return err("約定レートが不正です");
    if (!executedAt) return err("約定日時の形式が不正です");
    const pnlJpy =
      kind === "close" ? toNumber(get("取引損益（円換算）")) : null;
    if (kind === "close" && pnlJpy === null)
      return err("取引損益（円換算）が不正です");

    rows.push({
      no,
      pair,
      kind,
      side,
      quantity,
      rate,
      pnlJpy,
      executedAt,
      file: name,
      line,
    });
  });
  return {
    file: { name, status: "ok", rowCount: table.length - 1, message: null },
    rows,
    errors,
  };
}
