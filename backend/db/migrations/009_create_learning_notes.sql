-- 学習メモ（AIの分析 / 自分の気づき）と、そこから取り出した改善案
CREATE TABLE IF NOT EXISTS learning_notes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind             TEXT        NOT NULL CHECK (kind IN ('ai', 'self')),
  title            TEXT        NOT NULL,
  body             TEXT        NOT NULL DEFAULT '',
  ai_name          TEXT,
  data_range_label TEXT,
  raw_response     TEXT,
  emotion_tags     TEXT[]      NOT NULL DEFAULT '{}',
  next_rule        TEXT,
  source_trade_id  UUID        REFERENCES trades(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_notes_user ON learning_notes (user_id, created_at DESC);

-- 改善案。status: 要検証 / ルール化済み（検証中はルール側の validation_started_at で判断する）
CREATE TABLE IF NOT EXISTS note_improvements (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  note_id    UUID        NOT NULL REFERENCES learning_notes(id) ON DELETE CASCADE,
  position   INT         NOT NULL,
  text       TEXT        NOT NULL,
  sample_n   INT,
  status     TEXT        NOT NULL DEFAULT 'needs_check' CHECK (status IN ('needs_check', 'ruled')),
  rule_id    UUID        REFERENCES rules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_note_improvements_note ON note_improvements (note_id, position);
