import { useQuery } from "@tanstack/react-query";
import { fetchCandlesBatched } from "@/features/trades/hooks/candleBatcher";
import type { Trade } from "@/features/trades/types";
import { candleStartFor } from "@/features/trades/utils/chartData";
import { TF_SECONDS } from "@/features/trades/utils/chartRange";
import { CHART_TFS, type ChartTf } from "./bundleSchema";

/**
 * ダウンロード前の事前チェック: エントリーの足が保存済みか（時間足ごと）。
 * 画像を作るときと同じく「エントリーを含む足があるか」で判定する。
 * 要求は candleBatcher がまとめて送る（1トレード3本の要求を、30本ずつ1リクエストに）。
 * 戻り値は トレードID → 足が無い時間足の一覧（空なら全部ある）。
 */
export function useCandleAvailability(trades: readonly Trade[]) {
  const key = trades.map((t) => `${t.id}@${t.entryAt}`).join(",");
  return useQuery({
    queryKey: ["blog-export", "candle-availability", key],
    enabled: trades.length > 0,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const missing = new Map<string, ChartTf[]>();
      await Promise.all(
        trades.flatMap((t) =>
          CHART_TFS.map(async (tf) => {
            const step = TF_SECONDS[tf] * 1000;
            const entry = Date.parse(t.entryAt);
            let has = false;
            try {
              const res = await fetchCandlesBatched(tf, {
                from: new Date(entry - step).toISOString(),
                to: new Date(entry + step).toISOString(),
                warmup: 0,
              });
              has =
                res.hasData &&
                candleStartFor(res.candles, entry / 1000, TF_SECONDS[tf]) !==
                  null;
            } catch {
              has = false;
            }
            if (!has) missing.set(t.id, [...(missing.get(t.id) ?? []), tf]);
          }),
        ),
      );
      return missing;
    },
  });
}
