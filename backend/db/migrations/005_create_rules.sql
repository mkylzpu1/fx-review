-- ルール（発注前チェックの項目）。無効化しても過去の判定は残す
CREATE TABLE IF NOT EXISTS rules (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  description           TEXT        NOT NULL DEFAULT '',
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order            INT         NOT NULL DEFAULT 0,
  auto_key              TEXT        CHECK (auto_key IN ('sl_set', 'risk_within_limit', 'hold_to_tp')),
  validation_target_n   INT         NOT NULL DEFAULT 10,
  validation_started_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rules_user ON rules (user_id, sort_order);
