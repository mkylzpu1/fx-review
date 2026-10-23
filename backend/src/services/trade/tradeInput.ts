import { ValidationError } from "../../lib/errors";
import { validatePlan } from "./calc";
import type { ExitMethod, TradeInput, TradeStatus } from "../../types/trade";

export interface NormalizedExit {
  status: TradeStatus;
  exitMethod: ExitMethod;
}

/**
 * 入力の整合性を検証し、保存するステータスと決済方法を決める（純粋関数）。
 * SL・TP・根拠などは任意。入力されたものだけ検証する（指示書 §7）。
 * RRが最低値未満でも保存できる（警告は画面側）。
 */
export function normalizeTradeInput(input: TradeInput): NormalizedExit {
  const hasExitAt = input.exitAt !== null;
  const hasExitPrice = input.exitPrice !== null;
  if (hasExitAt !== hasExitPrice) {
    throw new ValidationError("決済日時と決済価格は両方入力してください");
  }

  const errors = validatePlan(
    input.side,
    input.entryPrice,
    input.slPrice,
    input.tpPrice,
  );
  const first = errors.sl ?? errors.tp;
  if (first) throw new ValidationError(first);

  if (input.exitAt !== null) {
    if (Date.parse(input.exitAt) < Date.parse(input.entryAt)) {
      throw new ValidationError("決済日時はエントリー日時より後にしてください");
    }
  }

  if (input.draft) {
    return {
      status: "draft",
      exitMethod: hasExitAt ? defaultExit(input.exitMethod) : "open",
    };
  }
  if (!hasExitAt) return { status: "open", exitMethod: "open" };
  return { status: "closed", exitMethod: defaultExit(input.exitMethod) };
}

/** 決済済みで方法が未指定（open）なら手動決済として扱う */
function defaultExit(m: ExitMethod): ExitMethod {
  return m === "open" ? "manual" : m;
}
