import type { MissingItem } from "../types";

const LABEL: Record<MissingItem, string> = {
  sl: "SL未入力",
  tp: "TP未入力",
  rationale: "根拠なし",
  open: "未決済",
};

/** 未入力の項目を、文字で示すバッジ（色だけに頼らない） */
export function MissingBadges({ missing }: { missing: MissingItem[] }) {
  if (missing.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {missing.map((m) => (
        <span
          key={m}
          className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-sub"
        >
          {LABEL[m]}
        </span>
      ))}
    </span>
  );
}
