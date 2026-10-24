import { ruleStore } from "../../stores/ruleStore";
import { settingsStore } from "../../stores/settingsStore";
import { tradeService } from "../trade/tradeService";
import {
  buildExport,
  type ExportFormat,
  type ExportOutput,
} from "./exportBuilder";
import type { Include } from "./exportColumns";
import { rangeFrom, type ExportRange } from "./exportRange";

export interface ExportRequest {
  range: ExportRange;
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
      tradeService.listAll(userId, {
        from: rangeFrom(req.range, timezone, now),
      }),
      ruleStore.list(userId),
    ]);
    return buildExport({
      views,
      rules,
      maxRiskPct: settings?.maxRiskPct ?? 1,
      minRr: settings?.minRr ?? 2,
      timezone,
      range: req.range,
      format: req.format,
      include: req.include,
      now,
    });
  },
};
