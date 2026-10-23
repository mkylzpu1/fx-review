import type { CurrencyPair, TagKind } from "../types/settings";

/** 初回作成時に投入する通貨ペア（USDJPYのみ。1万通貨・1pip=100円 → 1lot・1pip=1,000円） */
export const DEFAULT_PAIRS: Omit<CurrencyPair, "id">[] = [
  {
    symbol: "USDJPY",
    pipSize: 0.01,
    pipValueJpyPerLot: 1000,
    showInPicker: true,
  },
];

/** 初回作成時に投入する根拠・感情タグ（設計画面の初期値） */
export const DEFAULT_TAGS: Record<TagKind, string[]> = {
  rationale: [
    "押し目買い",
    "戻り売り",
    "ブレイク",
    "逆張り",
    "15分足 EMA21タッチ",
    "上位足順張り",
    "指標前後",
    "ダブルボトム・トップ",
  ],
  emotion: ["冷静", "不安", "焦り", "取り返したい", "退屈", "自信過剰"],
};
