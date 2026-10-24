import { CANDLE_PAIR, MAX_1M_ROWS, TF_SECONDS } from "../../constants/candles";
import { logger } from "../../lib/logger";
import { candleStore } from "../../stores/candleStore";
import {
  excursionStore,
  type ExcursionTarget,
  type ExcursionValues,
} from "../../stores/excursionStore";
import { calcExcursion } from "../candles/excursion";

const EMPTY: ExcursionValues = {
  mfePips: null,
  maePips: null,
  afterMaxPips: null,
};

/** 1件分を計算する。未決済・対象外の通貨ペア・足が無いときは null の値を返す */
async function compute(t: ExcursionTarget): Promise<ExcursionValues> {
  if (t.pair !== CANDLE_PAIR || t.exitAt === null || t.exitPrice === null)
    return EMPTY;
  const afterSeconds = t.chartBarsAfter * TF_SECONDS[t.chartDefaultTf];
  const range = await candleStore.range(
    CANDLE_PAIR,
    Math.floor(t.entryAt / 60) * 60,
    t.exitAt + afterSeconds + 60,
    MAX_1M_ROWS,
  );
  if (range.overLimit) {
    logger.warn("MFE/MAE: 範囲が広すぎるため計算しません", { tradeId: t.id });
    return EMPTY;
  }
  return calcExcursion(range.candles, {
    side: t.side,
    entryAt: t.entryAt,
    entryPrice: t.entryPrice,
    exitAt: t.exitAt,
    exitPrice: t.exitPrice,
    pipSize: t.pipSize,
    afterSeconds,
  });
}

export const excursionService = {
  /**
   * トレード保存後に呼ぶ。決済・価格を直したときに古い値が残らないよう、null も書き込む。
   * ローソク足が無いだけで保存を失敗させないため、失敗は警告ログにとどめる。
   */
  async refreshTrade(userId: string, id: string): Promise<void> {
    try {
      const target = await excursionStore.findTarget(userId, id);
      if (!target) return;
      await excursionStore.set(id, await compute(target));
    } catch (e) {
      logger.warn("MFE/MAE の更新に失敗しました", {
        tradeId: id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  /** 足を同期したあと、その期間にエントリーした決済済みトレード全件を計算し直す */
  async refreshRange(
    from: Date,
    to: Date,
  ): Promise<{ total: number; withData: number }> {
    const targets = await excursionStore.listClosedEnteredBetween(from, to);
    let withData = 0;
    for (const t of targets) {
      const v = await compute(t);
      await excursionStore.set(t.id, v);
      if (v.mfePips !== null) withData += 1;
    }
    return { total: targets.length, withData };
  },
};
