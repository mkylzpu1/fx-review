import { create } from "zustand";

/**
 * チャートの全画面表示の状態。
 * 前後のトレードへ移っても全画面のまま見返せるように、チャート領域の外に持つ。
 * 詳細画面を離れるとき（TradeDetailPage のアンマウント）に false へ戻す。
 */
interface ChartUiState {
  fullscreen: boolean;
  setFullscreen: (v: boolean) => void;
}

export const useChartUiStore = create<ChartUiState>((set) => ({
  fullscreen: false,
  setFullscreen: (v) => set({ fullscreen: v }),
}));
