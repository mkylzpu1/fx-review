-- 週次レビュー（週は月曜始まり。1週1件）
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  week_start     DATE        NOT NULL,
  memo           TEXT        NOT NULL DEFAULT '',
  next_rule_id   UUID        REFERENCES rules(id) ON DELETE SET NULL,
  next_rule_text TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);
