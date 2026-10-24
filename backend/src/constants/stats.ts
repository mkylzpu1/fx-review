/** 強み・弱みを言い切るのに必要な最小件数。これ未満は「要検証」 */
export const MIN_SAMPLE_FOR_VERDICT = 15;
/** 「あと〜件ほど記録してから判断」の目安に使う件数 */
export const SAMPLE_SHORTFALL_HINT = 10;
/** 週次レビューで「傾向ではなく見直しの材料」と注記する件数の上限 */
export const WEEKLY_FEW_TRADES = 5;
/** ルール詳細の「遵守率の週次推移」に出す週数（今週を含む） */
export const RULE_DETAIL_WEEKS = 8;
/** ルール詳細の「直近の遵守率」に使う週数（今週を含む） */
export const RULE_DETAIL_RECENT_WEEKS = 4;
/** ルール詳細に並べる「破ったトレード」の最大件数（新しい順） */
export const RULE_DETAIL_BROKEN_LIMIT = 20;
