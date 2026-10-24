import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  TIMEFRAMES,
  type AccountSettings,
  type EmaSetting,
  type Timeframe,
} from "@/features/settings/types";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useChartUiStore } from "../chartUiStore";
import type { Trade } from "../types";
import {
  clearChartPrefs,
  loadChartPrefs,
  saveChartPrefs,
  type ChartPrefs,
} from "../utils/chartPrefs";
import { DEFAULT_OVERLAYS } from "../utils/chartOverlays";
import { excursionLevels, hasExcursion } from "../utils/excursionLevels";
import { CandleSyncButton } from "./CandleSyncButton";
import { ChartLegend } from "./ChartLegend";
import { ChartPane, TimeframeSelect } from "./ChartPane";
import { EmaControls } from "./EmaControls";

// 設定が未作成（オンボーディング前）のときの表示
const FALLBACK = {
  tf: "1h" as Timeframe,
  before: 40,
  after: 20,
  emas: [{ period: 20, visible: true }] as EmaSetting[],
};

/** 設定の値だけで作る初期の表示設定（保存済みの表示設定が無いとき・初期値に戻すとき） */
function defaultPrefs(settings: AccountSettings | null): ChartPrefs {
  const tf = settings?.chartDefaultTf ?? FALLBACK.tf;
  return {
    tf,
    emas: settings?.emaSettings ?? FALLBACK.emas,
    showAfter: true,
    fixedY: false,
    overlays: DEFAULT_OVERLAYS,
    dual: false,
    // 2画面にしたとき、もう1枚は1つ大きい（なければ小さい）時間足にする
    tf2: TIMEFRAMES[
      Math.min(TIMEFRAMES.indexOf(tf) + 1, TIMEFRAMES.length - 1)
    ],
  };
}

interface Props {
  trade: Trade;
  pipSize: number;
  settings: AccountSettings | null;
}

/** トレード詳細のチャート領域: 時間足・EMA・エントリー後の値動きの切り替えと、1〜2枚のチャート */
export function ChartPanel({ trade, pipSize, settings }: Props) {
  const base = useMemo(() => defaultPrefs(settings), [settings]);
  const [saved, setSaved] = useState(() => loadChartPrefs());
  const prefs: ChartPrefs = { ...base, ...saved };
  const hasSaved = Object.keys(saved).length > 0;

  /** 表示設定を変えて、ブラウザにも覚えておく（次のトレード・次回以降も同じ見た目で開く） */
  const update = (patch: Partial<ChartPrefs>) => {
    const next = { ...prefs, ...patch };
    setSaved(next);
    saveChartPrefs(next);
  };
  const reset = () => {
    clearChartPrefs();
    setSaved({});
  };

  const fullscreen = useChartUiStore((s) => s.fullscreen);
  const setFullscreen = useChartUiStore((s) => s.setFullscreen);
  const [measureSignal, setMeasureSignal] = useState(0);

  // 全画面中は Esc で閉じ、背面のスクロールを止める
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen, setFullscreen]);

  // キーボード: F=全画面 / 1〜6=時間足 / M=pipsを測る / D=2画面
  useHotkeys({
    f: () => setFullscreen(!fullscreen),
    m: () => setMeasureSignal((n) => n + 1),
    d: () => update({ dual: !prefs.dual }),
    ...Object.fromEntries(
      TIMEFRAMES.map((t, i) => [String(i + 1), () => update({ tf: t })]),
    ),
  });

  const before = settings?.chartBarsBefore ?? FALLBACK.before;
  const after = settings?.chartBarsAfter ?? FALLBACK.after;
  const levels = useMemo(
    () => excursionLevels(trade, pipSize),
    [trade, pipSize],
  );

  const paneProps = {
    trade,
    pipSize,
    emas: prefs.emas,
    showAfter: prefs.showAfter,
    overlays: prefs.overlays,
    before,
    after,
    fullscreen,
    measureToggleSignal: measureSignal,
  };

  return (
    <section
      className={
        fullscreen
          ? "fixed inset-0 z-[60] flex flex-col gap-3 overflow-y-auto bg-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
          : "card min-w-0 space-y-3"
      }
      aria-label="チャート"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TimeframeSelect
          value={prefs.tf}
          onChange={(tf) => update({ tf })}
          label="時間足"
        />
        <div className="flex flex-wrap items-center gap-x-3">
          <label className="flex min-h-touch items-center gap-2 text-sm text-ink-sub">
            <input
              type="checkbox"
              checked={prefs.showAfter}
              onChange={(e) => update({ showAfter: e.target.checked })}
            />
            エントリー後の値動き
          </label>
          <button
            type="button"
            className="btn min-h-touch"
            aria-pressed={prefs.dual}
            onClick={() => update({ dual: !prefs.dual })}
          >
            {prefs.dual ? "1画面に戻す" : "時間足を並べる"}
          </button>
          <button
            type="button"
            className="btn min-h-touch"
            aria-pressed={fullscreen}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? "全画面を閉じる" : "全画面"}
          </button>
        </div>
      </div>
      <EmaControls emas={prefs.emas} onChange={(emas) => update({ emas })} />
      <ChartLegend
        overlays={prefs.overlays}
        onChange={(overlays) => update({ overlays })}
        hasTp={trade.tpPrice !== null}
        hasSl={trade.slPrice !== null}
        hasExit={trade.exitAt !== null && trade.exitPrice !== null}
        hasExcursion={hasExcursion(levels)}
      />
      {hasSaved && (
        <p className="text-xs text-ink-mute">
          この表示設定（時間足・EMA・凡例・縦軸固定）は、次のトレードにも引き継ぎます。{" "}
          <button
            type="button"
            className="text-accent-link underline"
            onClick={reset}
          >
            設定の初期値に戻す
          </button>
        </p>
      )}

      <div
        className={
          prefs.dual
            ? `grid min-w-0 gap-3 md:grid-cols-2 ${fullscreen ? "min-h-0 flex-1" : ""}`
            : fullscreen
              ? "flex min-h-0 flex-1 flex-col"
              : ""
        }
      >
        <ChartPane
          {...paneProps}
          tf={prefs.tf}
          onTfChange={(tf) => update({ tf })}
          fixedY={prefs.fixedY}
          onFixedYChange={(fixedY) => update({ fixedY })}
          title={prefs.dual ? "画面1" : undefined}
        />
        {prefs.dual && (
          <SecondPane
            paneProps={paneProps}
            tf={prefs.tf2}
            onTfChange={(tf2) => update({ tf2 })}
          />
        )}
      </div>

      <CandleSyncButton tradeId={trade.id} />
      <p className="text-xs text-ink-mute">
        チャートの価格はMT5の配信値のため、楽天FXの約定価格とわずかにずれることがあります。
      </p>
    </section>
  );
}

/** 2画面目。縦軸固定は画面ごとに持つ（覚えておくのは1画面目だけ） */
function SecondPane({
  paneProps,
  tf,
  onTfChange,
}: {
  paneProps: Omit<
    ComponentProps<typeof ChartPane>,
    "tf" | "onTfChange" | "fixedY" | "onFixedYChange"
  >;
  tf: Timeframe;
  onTfChange: (tf: Timeframe) => void;
}) {
  const [fixedY, setFixedY] = useState(false);
  return (
    <ChartPane
      {...paneProps}
      // 測定のキーボード操作は1画面目だけに効かせる
      measureToggleSignal={0}
      tf={tf}
      onTfChange={onTfChange}
      fixedY={fixedY}
      onFixedYChange={setFixedY}
      title="画面2"
      headerExtra={
        <TimeframeSelect
          value={tf}
          onChange={onTfChange}
          label="時間足（画面2）"
        />
      }
    />
  );
}
