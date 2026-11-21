import { ruleStore } from "../../stores/ruleStore";
import { settingsStore } from "../../stores/settingsStore";
import { tradeService } from "../trade/tradeService";
import {
  buildExport,
  type ExportFormat,
  type ExportOutput,
} from "./exportBuilder";
import type { Include } from "./exportColumns";

export interface ExportRequest {
  /** 対象期間の開始・終了（ISO）。両方省略で「すべて」 */
  from?: string;
  to?: string;
  format: ExportFormat;
  include: Include;
}

export const exportService = {
  async build(
    userId: string,
    req: ExportRequest,
    now = new Date(),
  ): Promise<ExportOutput> {
    const settings = await settingsStore.get(userId);
    const timezone = settings?.timezone ?? "Asia/Tokyo";
    const [views, rules] = await Promise.all([
      tradeService.listAll(userId, { from: req.from, to: req.to }),
      ruleStore.list(userId),
    ]);
    return buildExport({
      views,
      rules,
      maxRiskPct: settings?.maxRiskPct ?? 1,
      minRr: settings?.minRr ?? 2,
      timezone,
      from: req.from,
      to: req.to,
      format: req.format,
      include: req.include,
      now,
    });
  },
};
