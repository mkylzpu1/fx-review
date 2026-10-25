-- ロットの単位を「1 lot = 100,000通貨」から「1 lot = 10,000通貨」に切り替えるための、既存データの変換。
-- 実行前に必ず make backup でバックアップを取ること。**1回だけ**実行する（2回流すと10倍ずつずれる）。
--
--   docker exec -i fx-review-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < script/migrate-lot-unit.sql
--
-- 変換の内容:
--   trades.lots                           ×10  （例: 0.1 → 1.0）
--   currency_pairs.pip_value_jpy_per_lot  ÷10  （例: 1000 → 100）
-- 円損益・pips・想定リスクは「ロット × 1lotあたり円」で決まるため、両方を同時に変えれば値は変わらない。
BEGIN;

-- 二重実行の防止: すでに 100 円になっている通貨ペアがあれば中断する
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM currency_pairs WHERE symbol = 'USDJPY' AND pip_value_jpy_per_lot <= 100) THEN
    RAISE EXCEPTION 'すでに変換済みの可能性があります（USDJPY の 1lot・1pip あたり円が 100 以下）';
  END IF;
END $$;

UPDATE trades SET lots = lots * 10;
UPDATE currency_pairs SET pip_value_jpy_per_lot = pip_value_jpy_per_lot / 10;

COMMIT;
