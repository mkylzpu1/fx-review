-- 通貨ペア（pip幅・1lot1pipあたりの円）
CREATE TABLE IF NOT EXISTS currency_pairs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  symbol                TEXT          NOT NULL,
  pip_size              NUMERIC       NOT NULL CHECK (pip_size > 0),
  pip_value_jpy_per_lot NUMERIC       NOT NULL CHECK (pip_value_jpy_per_lot > 0),
  show_in_picker        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);
