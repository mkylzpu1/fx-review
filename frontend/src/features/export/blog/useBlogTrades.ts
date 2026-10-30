import { useSettings } from "@/features/settings/hooks/useSettingsApi";
import { useAllTrades } from "@/features/trades/hooks/useTradesApi";
import { fetchBounds, validateRange } from "./dateUtils";

export const DEFAULT_TIMEZONE = "Asia/Tokyo";

/**
 * 期間のトレードを取得する（既存の GET /trades を使う）。
 * 取得は前後に余裕を持たせ、実際の絞り込みは、設定のタイムゾーンの暦日で groupByDay が行う。
 * 期間が不正なときは取得しない。
 */
export function useBlogTrades(from: string, to: string) {
  const settings = useSettings();
  const timeZone = settings.data?.timezone ?? DEFAULT_TIMEZONE;
  const error = validateRange(from, to);
  const bounds = fetchBounds(from || "1970-01-01", to || "1970-01-01");
  const trades = useAllTrades(bounds, {
    enabled: error === null && !settings.isLoading,
  });
  return {
    timeZone,
    settings: settings.data ?? null,
    rangeError: error,
    trades: trades.data?.items ?? [],
    isLoading: settings.isLoading || (error === null && trades.isLoading),
    isError: settings.isError || trades.isError,
    refetch: () => void trades.refetch(),
  };
}
