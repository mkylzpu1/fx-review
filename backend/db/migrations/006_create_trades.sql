-- トレード（1トレード = 新規1回 + 決済1回）。pips・R・勝敗などの導出値は保存しない
CREATE TABLE IF NOT EXISTS trades (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  source          TEXT          NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'rakuten_csv')),
  source_key      TEXT,
  pair            TEXT          NOT NULL,
  side            TEXT          NOT NULL CHECK (side IN ('buy', 'sell')),
  lots            NUMERIC(8,2)  NOT NULL CHECK (lots > 0),
  entry_at        TIMESTAMPTZ   NOT NULL,
  entry_price     NUMERIC(12,5) NOT NULL,
  sl_price        NUMERIC(12,5),
  tp_price        NUMERIC(12,5),
  sl_reason       TEXT,
  tp_reason       TEXT,
  rationale_memo  TEXT,
  confidence      SMALLINT      CHECK (confidence BETWEEN 1 AND 5),
  exit_at         TIMESTAMPTZ,
  exit_price      NUMERIC(12,5),
  exit_method     TEXT          NOT NULL DEFAULT 'open'
                  CHECK (exit_method IN ('open', 'tp', 'sl', 'manual', 'breakeven')),
  pnl_jpy         BIGINT,
  insight         TEXT,
  next_rule       TEXT,
  status          TEXT          NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  -- ローソク足が必要なため保存する導出値（P2で計算）
  mfe_pips        NUMERIC(8,1),
  mae_pips        NUMERIC(8,1),
  after_max_pips  NUMERIC(8,1),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trades_source_key ON trades (user_id, source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_user_entry ON trades (user_id, entry_at DESC) WHERE deleted_at IS NULL;
