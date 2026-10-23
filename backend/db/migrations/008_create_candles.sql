-- ローソク足（USDJPYの1分足のみ保存。上位足はサービス層で集計する）
-- 市場データなので user_id を持たない共有キャッシュ
CREATE TABLE IF NOT EXISTS candles_1m (
  pair       TEXT           NOT NULL,
  open_time  TIMESTAMPTZ    NOT NULL,
  open       NUMERIC(12, 3) NOT NULL,
  high       NUMERIC(12, 3) NOT NULL,
  low        NUMERIC(12, 3) NOT NULL,
  close      NUMERIC(12, 3) NOT NULL,
  -- 取得元（'dukascopy' / 'mock'）。モックデータを使っているときに画面で示すため
  source     TEXT           NOT NULL DEFAULT 'dukascopy',
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pair, open_time)
);
