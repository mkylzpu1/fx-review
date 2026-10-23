#!/bin/bash
# ローカルDBセットアップ（初回のみ）
# docker compose up -d postgres 実行後に実行する

set -euo pipefail

PGCONN="postgresql://postgres:postgres@localhost:5432/postgres"

echo "PostgreSQL にマイグレーションを適用中..."
for f in $(ls backend/db/migrations/*.sql | sort); do
  echo "  applying: $f"
  psql "$PGCONN" -f "$f"
done

echo "完了"
