import type { MissingItem } from "../types";

const LABEL: Record<MissingItem, string> = {
  sl: "SL未入力",
  tp: "TP未入力",
  rationale: "根拠なし",
  open: "未決済",
};

/** 未入力の項目を、文字だけで示す（枠や塗りは使わない） */
export function MissingBadges({ missing }: { missing: MissingItem[] }) {
  if (missing.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {missing.map((m) => (
        <span
          key={m}
          className="text-xs text-ink-mute underline decoration-dashed underline-offset-4"
        >
          {LABEL[m]}
        </span>
      ))}
    </span>
  );
}
