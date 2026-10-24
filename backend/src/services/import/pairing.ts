import type {
  ExecutionRow,
  ImportRowError,
  ImportTrade,
} from "../../types/import";

/** 数量（通貨単位）→ lot。1 lot = 100,000通貨 */
const UNITS_PER_LOT = 100_000;

export const toSourceKey = (entryNo: string, exitNo: string | null) =>
  `rakuten:${entryNo}:${exitNo ?? ""}`;

/** 約定Noの昇順。数字だけなら数値で、そうでなければ文字列で比べる */
const byNo = (a: ExecutionRow, b: ExecutionRow) => {
  const na = Number(a.no);
  const nb = Number(b.no);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.no < b.no ? -1 : a.no > b.no ? 1 : 0;
};

export interface PairingResult {
  trades: ImportTrade[];
  errors: ImportRowError[];
  /** 複数ファイルで重なっていた同じ約定No.の行（先に読んだ方を残した） */
  duplicateRows: number;
}

/**
 * 約定行を「新規1回＋決済1回」のトレードにする（指示書 §12.2）。
 * 約定No.の昇順に並べ、決済行は逆の売買のキュー先頭（FIFO）の新規とペアにする。
 * 隣の行とペアにしない（複数ポジションを同時に持つため）。
 */
export function pairExecutions(allRows: ExecutionRow[]): PairingResult {
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  const rows: ExecutionRow[] = [];
  let duplicateRows = 0;
  for (const r of allRows) {
    const key = `${r.pair}|${r.no}`;
    if (seen.has(key)) {
      duplicateRows++;
      continue;
    }
    seen.add(key);
    rows.push(r);
  }
  rows.sort(byNo);

  const queues: Record<string, ExecutionRow[]> = {};
  const trades: ImportTrade[] = [];
  const qKey = (pair: string, side: string) => `${pair}|${side}`;

  for (const r of rows) {
    if (r.kind === "open") {
      (queues[qKey(r.pair, r.side)] ??= []).push(r);
      continue;
    }
    // 決済行の売買は決済注文の向き。買いポジションを決済する行は「売」
    const posSide = r.side === "sell" ? "buy" : "sell";
    const open = queues[qKey(r.pair, posSide)]?.shift();
    const rowErr = (message: string) =>
      errors.push({
        file: r.file,
        line: r.line,
        executionNo: r.no,
        message,
      });
    if (!open) {
      rowErr("この決済に対応する新規の約定が見つかりません");
      continue;
    }
    if (open.quantity !== r.quantity) {
      rowErr(
        `新規（約定No.${open.no}）と数量が一致しません（${open.quantity} / ${r.quantity}）。分割決済は取り込めません`,
      );
      continue;
    }
    trades.push({
      sourceKey: toSourceKey(open.no, r.no),
      entryNo: open.no,
      exitNo: r.no,
      pair: open.pair,
      side: posSide,
      lots: open.quantity / UNITS_PER_LOT,
      entryAt: open.executedAt,
      entryPrice: open.rate,
      exitAt: r.executedAt,
      exitPrice: r.rate,
      pnlJpy: r.pnlJpy,
      status: "closed",
    });
  }

  // 決済が無いまま残った新規は未決済のトレードとして取り込む
  for (const q of Object.values(queues)) {
    for (const open of q) {
      trades.push({
        sourceKey: toSourceKey(open.no, null),
        entryNo: open.no,
        exitNo: null,
        pair: open.pair,
        side: open.side,
        lots: open.quantity / UNITS_PER_LOT,
        entryAt: open.executedAt,
        entryPrice: open.rate,
        exitAt: null,
        exitPrice: null,
        pnlJpy: null,
        status: "open",
      });
    }
  }
  trades.sort((a, b) =>
    a.entryAt < b.entryAt
      ? -1
      : a.entryAt > b.entryAt
        ? 1
        : Number(a.entryNo) - Number(b.entryNo),
  );
  return { trades, errors, duplicateRows };
}
