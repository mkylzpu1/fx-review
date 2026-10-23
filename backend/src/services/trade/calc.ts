/**
 * トレードの価格・損益計算（純粋関数）。
 * フロントの frontend/src/utils/tradeCalc.ts と同じ内容・同じテストケースを保つこと。
 */
import type { Side } from "../../types/trade";

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** SLまでのpips = |entry − sl| / pipSize */
export function slPips(entry: number, sl: number | null, pipSize: number): number | null {
  return sl === null ? null : round(Math.abs(entry - sl) / pipSize, 1);
}

/** TPまでのpips = |tp − entry| / pipSize */
export function tpPips(entry: number, tp: number | null, pipSize: number): number | null {
  return tp === null ? null : round(Math.abs(tp - entry) / pipSize, 1);
}

/** 損益pips。売りは符号反転 */
export function resultPips(side: Side, entry: number, exit: number, pipSize: number): number {
  const diff = side === "buy" ? exit - entry : entry - exit;
  return round(diff / pipSize, 1);
}

/** R倍数 = pips / slPips。SLが無い・SLが0pipsなら null */
export function rMultiple(pips: number, sl: number | null): number | null {
  if (sl === null || sl === 0) return null;
  return round(pips / sl, 2);
}

/** リスクリワード = tpPips / slPips */
export function riskReward(sl: number | null, tp: number | null): number | null {
  if (sl === null || tp === null || sl === 0) return null;
  return round(tp / sl, 2);
}

/** 想定リスク円 = slPips × 1lot・1pipあたり円 × lots */
export function riskJpy(sl: number | null, pipValueJpyPerLot: number, lots: number): number | null {
  return sl === null ? null : Math.round(sl * pipValueJpyPerLot * lots);
}

/** 口座に対する想定リスク（%） */
export function riskPct(risk: number | null, balanceJpy: number): number | null {
  if (risk === null || balanceJpy <= 0) return null;
  return round((risk / balanceJpy) * 100, 2);
}

/** 手入力トレードの円損益 = pips × 1lot・1pipあたり円 × lots */
export function pnlFromPips(pips: number, pipValueJpyPerLot: number, lots: number): number {
  return Math.round(pips * pipValueJpyPerLot * lots);
}

export interface PlanErrors {
  sl?: string;
  tp?: string;
}

/** 買いのSLはエントリーより低く、売りは高く。TPはその逆。入力されたものだけ検証する */
export function validatePlan(
  side: Side,
  entry: number,
  sl: number | null,
  tp: number | null,
): PlanErrors {
  const errors: PlanErrors = {};
  if (sl !== null && (side === "buy" ? sl >= entry : sl <= entry)) {
    errors.sl =
      side === "buy"
        ? "買いのSLはエントリーより低く設定してください"
        : "売りのSLはエントリーより高く設定してください";
  }
  if (tp !== null && (side === "buy" ? tp <= entry : tp >= entry)) {
    errors.tp =
      side === "buy"
        ? "買いのTPはエントリーより高く設定してください"
        : "売りのTPはエントリーより低く設定してください";
  }
  return errors;
}

/** 保有時間（分）。未決済は null */
export function holdMinutes(entryAt: string, exitAt: string | null): number | null {
  if (!exitAt) return null;
  return Math.round((Date.parse(exitAt) - Date.parse(entryAt)) / 60000);
}
