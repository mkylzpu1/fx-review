-- 根拠・感情タグ（論理削除: 削除してもトレードに付いたタグは残す）
CREATE TABLE IF NOT EXISTS tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('rationale', 'emotion')),
  name        TEXT        NOT NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_user_kind ON tags (user_id, kind) WHERE deleted_at IS NULL;
