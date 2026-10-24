import { round } from "../trade/calc";
import type { Side } from "../../types/trade";
import type { Candle } from "./CandleProvider";

const MINUTE = 60;
/** 保有区間の端の足がこれ以上ずれて見つかるときは、データが足りないとみなす（秒） */
export const COVERAGE_TOLERANCE_SEC = 10 * MINUTE;

export interface ExcursionInput {
  side: Side;
  entryAt: number;
  entryPrice: number;
  exitAt: number;
  exitPrice: number;
  pipSize: number;
  /** 決済後に見る長さ（秒）。チャートの「決済後の表示本数 × 時間足」 */
  afterSeconds: number;
}

export interface Excursion {
  /** 保有中の最大含み益（pips、0以上） */
  mfePips: number | null;
  /** 保有中の最大含み損（pips、0以下） */
  maePips: number | null;
  /** 決済後に、決済価格からさらに有利方向へ進んだ最大幅（pips、0以上） */
  afterMaxPips: number | null;
}

const floorMinute = (sec: number) => Math.floor(sec / MINUTE) * MINUTE;

/** 有利方向の価格差（買いは上、売りは下が有利） */
const favorable = (side: Side, base: number, c: Candle) =>
  side === "buy" ? c.high - base : base - c.low;
const adverse = (side: Side, base: number, c: Candle) =>
  side === "buy" ? c.low - base : base - c.high;

/**
 * 1分足から MFE / MAE / 決済後の最大到達を計算する（純粋関数。入力は時刻の昇順）。
 * - 保有区間: エントリーの分〜決済の分（両端を含む）の足の高値・安値
 * - 保有区間の足が無い、または端が大きく欠けているとき（同期が足りない）は null
 * - 決済後は、決済の分の次の足から afterSeconds 以内の足。足が無ければ null
 */
export function calcExcursion(
  candles1m: Candle[],
  input: ExcursionInput,
): Excursion {
  const holdStart = floorMinute(input.entryAt);
  const holdEnd = floorMinute(input.exitAt);
  const hold = candles1m.filter(
    (c) => c.time >= holdStart && c.time <= holdEnd,
  );
  const after = candles1m.filter(
    (c) =>
      c.time > holdEnd && c.time <= holdEnd + Math.max(0, input.afterSeconds),
  );

  const covered =
    hold.length > 0 &&
    hold[0].time - holdStart <= COVERAGE_TOLERANCE_SEC &&
    holdEnd - hold[hold.length - 1].time <= COVERAGE_TOLERANCE_SEC;

  let mfePips: number | null = null;
  let maePips: number | null = null;
  if (covered) {
    const best = Math.max(
      ...hold.map((c) => favorable(input.side, input.entryPrice, c)),
    );
    const worst = Math.min(
      ...hold.map((c) => adverse(input.side, input.entryPrice, c)),
    );
    mfePips = round(Math.max(0, best) / input.pipSize, 1);
    maePips = round(Math.min(0, worst) / input.pipSize, 1);
  }

  const afterMaxPips =
    after.length === 0
      ? null
      : round(
          Math.max(
            0,
            ...after.map((c) => favorable(input.side, input.exitPrice, c)),
          ) / input.pipSize,
          1,
        );

  return { mfePips, maePips, afterMaxPips };
}
