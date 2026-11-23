-- 根拠タグの初期セットを増やした際、既にアカウント作成済みのユーザーには
-- settingsService.seedDefaults() が再実行されず新しいタグが増えないため、
-- 既存ユーザー全員に不足分だけ追加で投入するための一回限りのスクリプト。
--
--   docker exec -i fx-review-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < script/seed-rationale-tags.sql
--
-- 同名タグが既にある場合（有効・削除済みいずれも）は何もしない（ON CONFLICT DO NOTHING）。
-- 何度実行しても安全。

BEGIN;

WITH new_tags(name, ord) AS (
  VALUES
    ('レンジ上限での逆張り', 100),
    ('レンジ下限での逆張り', 101),
    ('レンジブレイク', 102),
    ('上昇トライアングル', 103),
    ('下降トライアングル', 104),
    ('チャネルライン（上昇）', 105),
    ('チャネルライン（下降）', 106),
    ('もみ合い放れ', 107),
    ('ソーサートップ・ボトム', 109),
    ('V字・逆V字反転', 110),
    ('N波動', 111),
    ('ボリンジャーバンドウォーク', 112),
    ('一目均衡表（雲抜け・三役）', 113),
    ('はらみ足', 114),
    ('十字線（同事線）', 115),
    ('たくり線', 116),
    ('三空・三兵（スリーソルジャーズ/クロウズ）', 117),
    ('要人発言・中銀会合（FOMC/日銀）', 118),
    ('東京仲値', 119)
)
INSERT INTO tags (user_id, kind, name, sort_order)
SELECT u.user_id, 'rationale', nt.name, nt.ord
FROM users u
CROSS JOIN new_tags nt
ON CONFLICT (user_id, kind, name) DO NOTHING;

COMMIT;
