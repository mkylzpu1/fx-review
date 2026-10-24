import { settingsStore } from "../../stores/settingsStore";
import { tradeService } from "../trade/tradeService";
import { buildStats, type StatsResult } from "./statsBuilder";

export interface StatsQuery {
  from?: string;
  to?: string;
  pair?: string;
}

export const statsService = {
  async get(userId: string, q: StatsQuery): Promise<StatsResult> {
    const [views, settings] = await Promise.all([
      tradeService.listAll(userId, q),
      settingsStore.get(userId),
    ]);
    return buildStats(views, settings?.timezone ?? "Asia/Tokyo");
  },
};
