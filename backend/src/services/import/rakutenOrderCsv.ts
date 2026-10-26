import type { OrderRow, OrderRowError } from "../../types/orderImport";
import type { ImportFileResult } from "../../types/import";
import { parseCsv, parseJstDateTime } from "./rakutenCsv";

/** 注文履歴CSVに必要な列。約定履歴CSV（約定No.の列）とはここで見分ける */
export const ORDER_REQUIRED_COLUMNS = [
  "注文No.",
  "注文パターン",
  "通貨ペア",
  "注文区分",
  "売買",
  "注文日時",
  "状態",
  "執行区分",
  "受注数量",
  "注文レート",
  "約定レート",
  "建約定レート",
] as const;

const PAIR_MAP: Record<string, string> = { "ドル/円": "USDJPY" };

const toNumber = (v: string): number | null => {
  const s = v.replace(/[,\s+]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** 先頭行を見て、注文履歴CSVかどうかを判定する（約定履歴は `約定No.` 列がある） */
export function isOrderCsv(text: string): boolean {
  const header = parseCsv(text.slice(0, 4000).split(/\r?\n/)[0] ?? "")[0] ?? [];
  const names = header.map((h) => h.trim());
  return names.includes("注文No.") && !names.includes("約定No.");
}

export interface ParsedOrderFile {
  file: ImportFileResult;
  rows: OrderRow[];
  errors: OrderRowError[];
}

export function parseRakutenOrderFile(
  name: string,
  text: string,
): ParsedOrderFile {
  const fail = (message: string): ParsedOrderFile => ({
    file: { name, status: "error", rowCount: 0, message },
    rows: [],
    errors: [],
  });
  const table = parseCsv(text);
  if (table.length === 0) return fail("ファイルが空です");
  const header = table[0].map((h) => h.trim());
  const missing = ORDER_REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0)
    return fail(
      `${missing.join("・")}の列がありません。楽天FX証券の注文履歴CSV（Shift_JIS）か確認してください。`,
    );
  const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<
    string,
    number
  >;

  const rows: OrderRow[] = [];
  const errors: OrderRowError[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof ORDER_REQUIRED_COLUMNS)[number]) =>
      (cells[idx[c]] ?? "").trim();
    const raw = get("注文No.");
    const err = (message: string) =>
      errors.push({ file: name, line, orderNo: raw || null, message });

    const no = Number(raw);
    if (!Number.isInteger(no)) return err("注文No.が不正です");
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
    const quantity = toNumber(get("受注数量"));
    if (quantity === null || quantity <= 0) return err("受注数量が不正です");
    const orderedAt = parseJstDateTime(get("注文日時"));
    if (!orderedAt) return err("注文日時の形式が不正です");
    const e = get("執行区分");
    const exec =
      e === "マーケット"
        ? "market"
        : e === "指値"
          ? "limit"
          : e === "逆指値"
            ? "stop"
            : "other";

    rows.push({
      no,
      pattern: get("注文パターン"),
      pair,
      kind,
      side,
      quantity,
      orderedAt,
      state: get("状態"),
      exec,
      orderRate: toNumber(get("注文レート")),
      fillRate: toNumber(get("約定レート")),
      openRate: toNumber(get("建約定レート")),
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
