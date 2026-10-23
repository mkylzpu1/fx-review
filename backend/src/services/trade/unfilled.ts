/**
 * 「入力のないトレード」の定義（指示書 §7 未入力キュー）。サーバー側のここが唯一の定義。
 *
 *   入力のない = 未決済、または SL・TP・根拠タグがいずれも空
 *
 * stores/tradeListStore.ts の QUEUE 条件（SQL）は、この定義に合わせている。
 * 変更するときは両方を直し、test/unit/services/unfilled.test.ts と統合テストで確認する。
 */
import type { MissingItem } from "../../types/trade";

export interface UnfilledInput {
  slPrice: number | null;
  tpPrice: number | null;
  exitAt: string | null;
  hasRationaleTag: boolean;
}

/** 行ごとの「未入力」タグ（SL・TP・根拠・未決済） */
export function computeMissing(t: UnfilledInput): MissingItem[] {
  const missing: MissingItem[] = [];
  if (t.slPrice === null) missing.push("sl");
  if (t.tpPrice === null) missing.push("tp");
  if (!t.hasRationaleTag) missing.push("rationale");
  if (t.exitAt === null) missing.push("open");
  return missing;
}

export function isUnfilled(t: UnfilledInput): boolean {
  return (
    t.exitAt === null ||
    (t.slPrice === null && t.tpPrice === null && !t.hasRationaleTag)
  );
}
