import {
  CANDLE_PAIR,
  MAX_1M_ROWS,
  MAX_BARS_PER_REQUEST,
  MAX_WARMUP_BARS,
  TF_SECONDS,
  type Timeframe,
} from "../../constants/candles";
import { ValidationError } from "../../lib/errors";
import { candleStore } from "../../stores/candleStore";
import type { Candle } from "./CandleProvider";
import { bucketStart, resample } from "./resample";

export interface CandleQuery {
  tf: Timeframe;
  /** 表示範囲（UTC秒）。to を含む足まで返す */
  fromSec: number;
  toSec: number;
  /** from より前に追加で返す足の本数（EMAのウォームアップ） */
  warmup: number;
}

export interface CandleResult {
  tf: Timeframe;
  candles: Candle[];
  /** 先頭から数えた、表示範囲より前のウォームアップの本数 */
  warmupCount: number;
  /** 表示範囲内に足が1本以上あるか（週末・祝日・未同期は false） */
  hasData: boolean;
  /** モックデータ（開発用の疑似データ）が含まれるか */
  mock: boolean;
}

/** 週末などの休場で足が減る分を見込んで、ウォームアップの時間幅を広げる倍率と余白 */
const WARMUP_SPAN_FACTOR = 1.5;
const WARMUP_SPAN_MARGIN_SEC = 3 * 86400;

export const candleService = {
  async get(q: CandleQuery): Promise<CandleResult> {
    if (!Number.isFinite(q.fromSec) || !Number.isFinite(q.toSec))
      throw new ValidationError("from / to の日時が不正です");
    if (q.toSec <= q.fromSec)
      throw new ValidationError("to は from より後にしてください");
    if (q.warmup < 0 || q.warmup > MAX_WARMUP_BARS)
      throw new ValidationError(
        `warmup は0〜${MAX_WARMUP_BARS}で指定してください`,
      );

    const step = TF_SECONDS[q.tf];
    const start = bucketStart(q.fromSec, q.tf);
    const end = bucketStart(q.toSec, q.tf) + step;
    // 表示範囲の足の本数が多すぎるときは、読み込む前に断る
    if ((end - start) / step > MAX_BARS_PER_REQUEST)
      throw new ValidationError(
        "範囲が広すぎます。範囲を狭めるか、大きい時間足を選んでください",
      );

    const loadFrom =
      q.warmup === 0
        ? start
        : bucketStart(
            start -
              Math.ceil(q.warmup * step * WARMUP_SPAN_FACTOR) -
              WARMUP_SPAN_MARGIN_SEC,
            q.tf,
          );

    const range = await candleStore.range(
      CANDLE_PAIR,
      loadFrom,
      end,
      MAX_1M_ROWS,
    );
    if (range.overLimit)
      throw new ValidationError(
        "範囲が広すぎます。範囲を狭めるか、大きい時間足を選んでください",
      );

    const bars = resample(range.candles, q.tf);
    const visible = bars.filter((b) => b.time >= start);
    const warm =
      q.warmup === 0 ? [] : bars.filter((b) => b.time < start).slice(-q.warmup);
    if (warm.length + visible.length > MAX_BARS_PER_REQUEST)
      throw new ValidationError(
        "範囲が広すぎます。範囲を狭めるか、大きい時間足を選んでください",
      );

    return {
      tf: q.tf,
      candles: [...warm, ...visible],
      warmupCount: warm.length,
      hasData: visible.length > 0,
      mock: range.hasMock,
    };
  },
};
