#!/bin/bash
# ローカルDB（Docker の PostgreSQL）を丸ごとバックアップする
#
#   ./script/backup-db.sh            # ./backups/ に保存（make backup と同じ）
#   BACKUP_DIR=~/Dropbox/fx ./script/backup-db.sh
#
# 環境変数:
#   BACKUP_DIR   保存先フォルダ（既定: <リポジトリ>/backups。git管理外）
#   KEEP         残す世代数（既定: 30。古いものから消す。0 なら消さない）
#   DB_CONTAINER コンテナ名（既定: fx-review-postgres）
#   PREFIX       ファイル名の先頭（既定: fx-review）

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${KEEP:-30}"
DB_CONTAINER="${DB_CONTAINER:-fx-review-postgres}"
PREFIX="${PREFIX:-fx-review}"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "エラー: コンテナ $DB_CONTAINER が起動していません。make db で起動してください。" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/${PREFIX}_${STAMP}.sql.gz"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

# --clean --if-exists: 復元時に既存のテーブルを作り直せるようにする
# 途中で失敗したときに壊れたファイルを残さないよう、完成してから名前を付ける
docker exec "$DB_CONTAINER" \
  pg_dump -U postgres -d postgres --clean --if-exists --no-owner \
  | gzip > "$TMP"

# 中身の確認（gzipとして読めること・空でないこと・テーブル定義が入っていること）
gzip -t "$TMP"
if ! gzip -dc "$TMP" | grep -q "CREATE TABLE"; then
  echo "エラー: バックアップにテーブル定義が見つかりません。保存しませんでした。" >&2
  exit 1
fi

mv "$TMP" "$OUT"
trap - EXIT
echo "バックアップしました: $OUT ($(du -h "$OUT" | cut -f1))"

# 古い世代を削除（同じ PREFIX のファイルだけ。restore前の退避ファイルは対象外）
if [ "$KEEP" -gt 0 ]; then
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/"${PREFIX}"_*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
    echo "古いバックアップを削除: $old"
  done
fi
