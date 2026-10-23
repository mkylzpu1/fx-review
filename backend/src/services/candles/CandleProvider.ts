/** time は UTC の秒 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** ローソク足の取得元。実装を差し替えられるようにインターフェースの裏に隠す */
export interface CandleProvider {
  /** 取得元の名前（candles_1m.source に保存する） */
  readonly source: string;
  fetch1m(pair: "USDJPY", from: Date, to: Date): Promise<Candle[]>;
}
