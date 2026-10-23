-- 口座・リスク・チャート設定（1ユーザー1行。行が無い = 未オンボーディング）
CREATE TABLE IF NOT EXISTS account_settings (
  user_id           TEXT          PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  balance_jpy       BIGINT        NOT NULL CHECK (balance_jpy > 0),
  max_risk_pct      NUMERIC(4,2)  NOT NULL DEFAULT 1.00,
  min_rr            NUMERIC(4,2)  NOT NULL DEFAULT 2.00,
  timezone          TEXT          NOT NULL DEFAULT 'Asia/Tokyo',
  chart_default_tf  TEXT          NOT NULL DEFAULT '1h'
                    CHECK (chart_default_tf IN ('1m','5m','15m','1h','4h','1d')),
  chart_bars_before INT           NOT NULL DEFAULT 120,
  chart_bars_after  INT           NOT NULL DEFAULT 60,
  ema_settings      JSONB         NOT NULL DEFAULT '[{"period":9,"visible":false},{"period":21,"visible":true},{"period":50,"visible":true},{"period":200,"visible":false}]',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
