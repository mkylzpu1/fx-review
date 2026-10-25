#!/bin/bash
# バックアップ（backup-db.sh で作った .sql.gz）からローカルDBを復元する
#
#   ./script/restore-db.sh backups/fx-review_20261025_180000.sql.gz
#   ./script/restore-db.sh --latest        # いちばん新しいバックアップ
#   ./script/restore-db.sh -y <ファイル>    # 確認を省略
#
# いまのDBの中身は置き換わる。そのため復元の前に、自動で退避バックアップ
# （pre-restore_*.sql.gz）を作る。復元に失敗したら、DBは変更前のまま（単一トランザクション）。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DB_CONTAINER="${DB_CONTAINER:-fx-review-postgres}"
PREFIX="${PREFIX:-fx-review}"

ASSUME_YES=false
FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true ;;
    --latest)
      # shellcheck disable=SC2012
      FILE="$(ls -1t "$BACKUP_DIR"/"${PREFIX}"_*.sql.gz 2>/dev/null | head -n 1 || true)"
      if [ -z "$FILE" ]; then
        echo "エラー: $BACKUP_DIR にバックアップがありません。" >&2
        exit 1
      fi
      ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *) FILE="$1" ;;
  esac
  shift
done

if [ -z "$FILE" ]; then
  echo "使い方: $0 [-y] <バックアップファイル.sql.gz | --latest>" >&2
  exit 1
fi
if [ ! -f "$FILE" ]; then
  echo "エラー: ファイルが見つかりません: $FILE" >&2
  exit 1
fi
if ! gzip -t "$FILE" 2>/dev/null; then
  echo "エラー: $FILE は壊れているか、gzipファイルではありません。" >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "エラー: コンテナ $DB_CONTAINER が起動していません。make db で起動してください。" >&2
  exit 1
fi

echo "復元するファイル: $FILE"
echo "いまのDBの中身は、このバックアップの内容に置き換わります。"
if [ "$ASSUME_YES" != true ]; then
  read -r -p "続けますか？ (yes と入力): " ANSWER
  if [ "$ANSWER" != "yes" ]; then
    echo "中止しました。"
    exit 1
  fi
fi

# 復元前の退避（世代整理の対象にならないよう PREFIX を変える）
echo "復元前のDBを退避します..."
PREFIX="pre-restore" KEEP=0 BACKUP_DIR="$BACKUP_DIR" DB_CONTAINER="$DB_CONTAINER" \
  "$ROOT/script/backup-db.sh"

echo "復元中..."
gzip -dc "$FILE" | docker exec -i "$DB_CONTAINER" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -q -o /dev/null

echo "復元しました。アプリを開いたままの場合は、画面を再読み込みしてください。"
