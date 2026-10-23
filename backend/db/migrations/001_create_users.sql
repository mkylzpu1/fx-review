-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  user_id       TEXT        PRIMARY KEY,
  email         TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  picture       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
