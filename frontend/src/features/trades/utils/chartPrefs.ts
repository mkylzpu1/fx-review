import {
  TIMEFRAMES,
  type EmaSetting,
  type Timeframe,
} from "@/features/settings/types";
import { DEFAULT_OVERLAYS, type ChartOverlays } from "./chartOverlays";

/** EMAの本数と期間の上限（EmaControls と同じ） */
const MAX_EMA = 8;
const MAX_EMA_PERIOD = 1000;

const KEY = "fxr.chartPrefs.v1";

/** ブラウザに覚えておくチャートの表示設定。トレードをまたいで引き継ぐ */
export interface ChartPrefs {
  tf: Timeframe;
  emas: EmaSetting[];
  showAfter: boolean;
  fixedY: boolean;
  overlays: ChartOverlays;
  /** 2画面（時間足を並べる）にするか */
  dual: boolean;
  /** 2画面目の時間足 */
  tf2: Timeframe;
}

const isTf = (v: unknown): v is Timeframe =>
  typeof v === "string" && (TIMEFRAMES as readonly string[]).includes(v);

function parseEmas(v: unknown): EmaSetting[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_EMA) return undefined;
  const out: EmaSetting[] = [];
  for (const e of v) {
    if (typeof e !== "object" || e === null) return undefined;
    const { period, visible } = e as Record<string, unknown>;
    if (
      typeof period !== "number" ||
      !Number.isInteger(period) ||
      period < 1 ||
      period > MAX_EMA_PERIOD ||
      typeof visible !== "boolean" ||
      out.some((x) => x.period === period)
    )
      return undefined;
    out.push({ period, visible });
  }
  return out;
}

function parseOverlays(v: unknown): ChartOverlays | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const src = v as Record<string, unknown>;
  const out = { ...DEFAULT_OVERLAYS };
  for (const k of Object.keys(DEFAULT_OVERLAYS) as (keyof ChartOverlays)[]) {
    // 後から増えた項目は、保存済みの設定に無くても初期値を使う
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  return out;
}

/** 保存済みの設定。壊れている・未保存の項目は含めない（呼び出し側が初期値で補う） */
export function loadChartPrefs(): Partial<ChartPrefs> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const src = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<ChartPrefs> = {};
    if (isTf(src.tf)) out.tf = src.tf;
    if (isTf(src.tf2)) out.tf2 = src.tf2;
    const emas = parseEmas(src.emas);
    if (emas) out.emas = emas;
    if (typeof src.showAfter === "boolean") out.showAfter = src.showAfter;
    if (typeof src.fixedY === "boolean") out.fixedY = src.fixedY;
    if (typeof src.dual === "boolean") out.dual = src.dual;
    const overlays = parseOverlays(src.overlays);
    if (overlays) out.overlays = overlays;
    return out;
  } catch {
    // 保存できない・壊れているときは、初期値で動かす
    return {};
  }
}

export function saveChartPrefs(prefs: ChartPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // 容量超過・プライベートモードなどでは保存しない
  }
}

export function clearChartPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}
