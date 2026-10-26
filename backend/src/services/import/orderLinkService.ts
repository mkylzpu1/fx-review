import { ValidationError } from "../../lib/errors";
import { orderLinkStore } from "../../stores/orderLinkStore";
import type { ImportFileResult } from "../../types/import";
import type {
  LinkResult,
  OrderPlan,
  OrderRowError,
  UnfilledOrder,
} from "../../types/orderImport";
import {
  ERROR_LIMIT,
  MAX_FILES,
  MAX_TOTAL_CHARS,
  type ImportFileInput,
} from "./importService";
import { groupOrders, linkPlansToTrades } from "./orderLinking";
import { isOrderCsv, parseRakutenOrderFile } from "./rakutenOrderCsv";

export const LIST_LIMIT = 100;

export interface OrderLinkPreview {
  kind: "orders";
  files: ImportFileResult[];
  summary: {
    /** 紐づけ対象の約定済み新規注文 */
    filledOrders: number;
    /** 取り込み済みトレードに紐づいた数 */
    matched: number;
    /** SL・TP・決済の仕方のどれかを新しく入れるトレード数 */
    willUpdate: number;
    /** 取り込み済みトレードが見つからなかった数（約定履歴を先に取り込む） */
    unmatched: number;
    slOnProfitSide: number;
    /** 取消・期限切れ・待機中で約定しなかった新規注文 */
    unfilled: number;
    /** リジェクト（約定前に拒否）の件数 */
    rejected: number;
    errorCount: number;
  };
  unmatched: OrderPlan[];
  unfilled: UnfilledOrder[];
  errors: OrderRowError[];
}

export interface OrderLinkCommit extends Omit<OrderLinkPreview, "unmatched"> {
  updated: number;
}

/** 全ファイルが注文履歴CSVなら true。混在はエラー（約定履歴と別々に取り込んでもらう） */
export function detectOrderFiles(files: ImportFileInput[]): boolean {
  const flags = files.map((f) => isOrderCsv(f.text));
  if (flags.every(Boolean)) return true;
  if (flags.some(Boolean))
    throw new ValidationError(
      "注文履歴CSVと約定履歴CSVは同時に取り込めません。別々に取り込んでください。",
    );
  return false;
}

async function analyze(userId: string, files: ImportFileInput[]) {
  if (files.length === 0) throw new ValidationError("ファイルがありません");
  if (files.length > MAX_FILES)
    throw new ValidationError(`ファイルは${MAX_FILES}個までです`);
  if (files.reduce((n, f) => n + f.text.length, 0) > MAX_TOTAL_CHARS)
    throw new ValidationError(
      "ファイルの合計サイズが大きすぎます。期間を分けて取り込んでください",
    );

  const parsed = files.map((f) => parseRakutenOrderFile(f.name, f.text));
  const rows = parsed.flatMap((p) => p.rows);
  const groups = groupOrders(rows);

  // ペアはUSDJPYのみ（指示書 §1）。照合の起点は一番古い注文日時
  let link: LinkResult = {
    updates: [],
    matched: 0,
    unmatched: [],
    slOnProfitSide: 0,
  };
  if (groups.plans.length > 0) {
    const from = groups.plans.map((p) => p.orderedAt).sort()[0];
    const candidates = await orderLinkStore.findCandidates(
      userId,
      groups.plans[0].pair,
      from,
    );
    link = linkPlansToTrades(groups.plans, candidates);
  }
  return {
    files: parsed.map((p) => p.file),
    errors: parsed.flatMap((p) => p.errors),
    groups,
    link,
  };
}

function toPreview(a: Awaited<ReturnType<typeof analyze>>): OrderLinkPreview {
  return {
    kind: "orders",
    files: a.files,
    summary: {
      filledOrders: a.groups.plans.length,
      matched: a.link.matched,
      willUpdate: a.link.updates.length,
      unmatched: a.link.unmatched.length,
      slOnProfitSide: a.link.slOnProfitSide,
      unfilled: a.groups.unfilled.length,
      rejected: a.groups.rejected,
      errorCount: a.errors.length,
    },
    unmatched: a.link.unmatched.slice(0, LIST_LIMIT),
    unfilled: a.groups.unfilled.slice(0, LIST_LIMIT),
    errors: a.errors.slice(0, ERROR_LIMIT),
  };
}

export const orderLinkService = {
  async preview(
    userId: string,
    files: ImportFileInput[],
  ): Promise<OrderLinkPreview> {
    return toPreview(await analyze(userId, files));
  },

  async commit(
    userId: string,
    files: ImportFileInput[],
  ): Promise<OrderLinkCommit> {
    const a = await analyze(userId, files);
    const updated = await orderLinkStore.applyUpdates(userId, a.link.updates);
    const { unmatched: _unmatched, ...rest } = toPreview(a);
    return { ...rest, updated };
  },
};
