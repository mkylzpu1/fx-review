import type { Trade } from "../types";

export interface ExcursionLevels {
  /** 保有中の最大含み益の価格 */
  mfe: number | null;
  /** 保有中の最大含み損の価格 */
  mae: number | null;
  /** 決済後に、さらに有利方向へ進んだ最大の価格 */
  afterMax: number | null;
}

const NONE: ExcursionLevels = { mfe: null, mae: null, afterMax: null };

/** 数値として使える値か（null・未定義・NaN を除く） */
const has = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** 小数の誤差を落とす（価格の桁は pip 幅 + 1桁） */
const fix = (v: number, pipSize: number) => {
  const digits = Math.max(0, Math.round(-Math.log10(pipSize))) + 1;
  return Number(v.toFixed(digits));
};

/**
 * バックエンドが計算した MFE / MAE / 決済後最大（pips）を、チャートに引く価格に直す。
 * 買いは上が有利、売りは下が有利。MAE は 0 以下で返ってくる。
 */
export function excursionLevels(t: Trade, pipSize: number): ExcursionLevels {
  if (!has(t.exitPrice)) return NONE;
  const dir = t.side === "buy" ? 1 : -1;
  return {
    mfe: !has(t.mfePips)
      ? null
      : fix(t.entryPrice + dir * t.mfePips * pipSize, pipSize),
    mae: !has(t.maePips)
      ? null
      : fix(t.entryPrice + dir * t.maePips * pipSize, pipSize),
    afterMax: !has(t.afterMaxPips)
      ? null
      : fix(t.exitPrice + dir * t.afterMaxPips * pipSize, pipSize),
  };
}

export const hasExcursion = (l: ExcursionLevels) =>
  l.mfe !== null || l.mae !== null || l.afterMax !== null;

export interface ExcursionInsight {
  /** SLまでの距離（pips）。SLが無ければ null */
  slPips: number | null;
  /** TPまでの距離（pips）。TPが無ければ null */
  tpPips: number | null;
  /** 最大含み損の時点で、SLまであと何pips残っていたか（負なら届いていた） */
  slMarginPips: number | null;
  /** 最大含み益が、TPの何%まで届いたか */
  tpReachPct: number | null;
}

/** 「SLの手前まで行ったか」「TPにどこまで近づいたか」を、詳細画面に出すための値 */
export function excursionInsight(t: Trade, pipSize: number): ExcursionInsight {
  const slPips = !has(t.slPrice)
    ? null
    : Math.round((Math.abs(t.entryPrice - t.slPrice) / pipSize) * 10) / 10;
  const tpPips = !has(t.tpPrice)
    ? null
    : Math.round((Math.abs(t.tpPrice - t.entryPrice) / pipSize) * 10) / 10;
  return {
    slPips,
    tpPips,
    slMarginPips:
      slPips === null || !has(t.maePips)
        ? null
        : Math.round((slPips - Math.abs(t.maePips)) * 10) / 10,
    tpReachPct:
      tpPips === null || tpPips === 0 || !has(t.mfePips)
        ? null
        : Math.round((t.mfePips / tpPips) * 100),
  };
}
