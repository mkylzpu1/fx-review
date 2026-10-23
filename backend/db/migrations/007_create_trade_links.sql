-- トレードとタグ・ルール判定の関連
CREATE TABLE IF NOT EXISTS trade_tags (
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

-- ルール判定（手動チェック分。自動判定ルールは取得時に計算する）
CREATE TABLE IF NOT EXISTS trade_rule_checks (
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  rule_id  UUID NOT NULL REFERENCES rules(id)  ON DELETE CASCADE,
  result   TEXT NOT NULL CHECK (result IN ('ok', 'ng', 'na')),
  PRIMARY KEY (trade_id, rule_id)
);
