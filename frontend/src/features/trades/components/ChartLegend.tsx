import { CHART_COLORS, SIDE_COLORS } from "@/constants/chartTheme";
import type { ChartOverlays } from "../utils/chartOverlays";

interface Item {
  key: keyof ChartOverlays;
  label: string;
  swatch: "dashed" | "dotted" | "arrow" | "shade";
  color: string;
}

interface Props {
  overlays: ChartOverlays;
  onChange: (next: ChartOverlays) => void;
  hasTp: boolean;
  hasSl: boolean;
  hasExit: boolean;
  /** 最大含み益・含み損などの値がある（足を同期済みの決済済みトレード） */
  hasExcursion?: boolean;
  /** 売買の向き。エントリー価格の線の色を、チャートと合わせる */
  side?: "buy" | "sell";
}

function Swatch({ kind, color }: { kind: Item["swatch"]; color: string }) {
  if (kind === "shade")
    return (
      <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12">
        <rect
          x="1"
          y="1"
          width="16"
          height="10"
          rx="2"
          fill={color}
          fillOpacity="0.35"
        />
      </svg>
    );
  if (kind === "arrow")
    return (
      <svg aria-hidden="true" width="18" height="12" viewBox="0 0 18 12">
        <path d="M9 1 L15 10 L3 10 Z" fill={color} />
      </svg>
    );
  return (
    <svg aria-hidden="true" width="22" height="12" viewBox="0 0 22 12">
      <line
        x1="1"
        y1="6"
        x2="21"
        y2="6"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={kind === "dashed" ? "5 3" : "1.5 3"}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** チャートの凡例。各行を押すと、その表示・非表示を切り替える */
export function ChartLegend({
  overlays,
  onChange,
  hasTp,
  hasSl,
  hasExit,
  hasExcursion = false,
  side,
}: Props) {
  const items: (Item & { show: boolean })[] = [
    {
      key: "entryLine",
      label: "エントリー価格",
      swatch: "dashed",
      color: side ? SIDE_COLORS[side] : CHART_COLORS.entry,
      show: true,
    },
    {
      key: "tpLine",
      label: "TP（利確）",
      swatch: "dashed",
      color: CHART_COLORS.tp,
      show: hasTp,
    },
    {
      key: "slLine",
      label: "SL（損切り）",
      swatch: "dashed",
      color: CHART_COLORS.sl,
      show: hasSl,
    },
    {
      key: "exitLine",
      label: "決済価格（勝ち緑・負け赤）",
      swatch: "dotted",
      color: CHART_COLORS.tp,
      show: hasExit,
    },
    {
      key: "excursion",
      label: "最大含み益・含み損・決済後最大",
      swatch: "dotted",
      color: CHART_COLORS.exit,
      show: hasExcursion,
    },
    {
      key: "afterShade",
      label: "エントリー以降の背景",
      swatch: "shade",
      color: CHART_COLORS.entry,
      show: true,
    },
    {
      key: "markers",
      label: "IN / OUT の矢印",
      swatch: "arrow",
      color: CHART_COLORS.exit,
      show: true,
    },
  ];
  return (
    <div
      role="group"
      aria-label="凡例"
      className="flex flex-wrap gap-x-1 gap-y-1"
    >
      {items
        .filter((i) => i.show)
        .map((i) => {
          const on = overlays[i.key];
          return (
            <button
              key={i.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...overlays, [i.key]: !on })}
              className={`inline-flex min-h-touch items-center gap-2 rounded-chip border border-line px-3 text-xs ${
                on ? "bg-tag text-ink" : "text-ink-mute line-through opacity-60"
              }`}
            >
              <Swatch kind={i.swatch} color={i.color} />
              {i.label}
            </button>
          );
        })}
    </div>
  );
}
