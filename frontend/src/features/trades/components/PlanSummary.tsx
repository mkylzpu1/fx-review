import { formatYenSigned } from "@/utils/format";
import type { PlanPreview } from "../utils/planPreview";

/** SL・TPから自動計算した想定（保存前に確認できる）。SLが空なら案内だけ出す */
export function PlanSummary({ preview }: { preview: PlanPreview }) {
  const has = preview.slPips !== null || preview.tpPips !== null;
  if (!has) {
    return (
      <p className="text-sm text-ink-mute">
        SLとTPを入れると、想定リスクとRRを自動で計算します（入力は任意です）。
      </p>
    );
  }
  const items: [string, string][] = [];
  if (preview.slPips !== null)
    items.push(["SLまで", `${preview.slPips.toFixed(1)} pips`]);
  if (preview.tpPips !== null)
    items.push(["TPまで", `${preview.tpPips.toFixed(1)} pips`]);
  if (preview.rr !== null) items.push(["RR", `1 : ${preview.rr.toFixed(2)}`]);
  if (preview.riskJpy !== null)
    items.push([
      "想定リスク",
      `${formatYenSigned(preview.riskJpy).replace("+", "")}${
        preview.riskPct !== null ? `（口座の${preview.riskPct}%）` : ""
      }`,
    ]);
  return (
    <div className="space-y-2">
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-sub">{k}</dt>
            <dd className="num text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {preview.warnings.map((w) => (
        <p key={w} role="status" className="text-sm text-caution">
          {w}
        </p>
      ))}
    </div>
  );
}
