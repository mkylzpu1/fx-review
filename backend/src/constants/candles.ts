/** ローソク足まわりの定数（取得元・区切りが確定・変更になったらここだけを直す） */

export const CANDLE_PAIR = "USDJPY";

/**
 * 取得元から取る価格の種類（既定は bid）。
 * 楽天FXのチャートと値がずれるため、確定したら持ち主がここを直せるようにしている
 */
export const CANDLE_PRICE_TYPE: "bid" | "ask" | "mid" = "bid";

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TF_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** 日足・4時間足の区切り: ニューヨーククローズ（現地17:00、夏時間に追従）基準 */
export const ROLLOVER_TIME_ZONE = "America/New_York";
export const ROLLOVER_HOUR = 17;

/** 同期時、この時間以内の足は後から値が更新されることがあるため上書きする */
export const RECENT_OVERWRITE_HOURS = 48;

/** 1回のAPIで返す足の本数の上限 */
export const MAX_BARS_PER_REQUEST = 2000;
/** 集計のために読み込む1分足の行数の上限 */
export const MAX_1M_ROWS = 300_000;

export const CANDLE_SOURCE = { dukascopy: "dukascopy", mock: "mock" } as const;
export type CandleSource = (typeof CANDLE_SOURCE)[keyof typeof CANDLE_SOURCE];
