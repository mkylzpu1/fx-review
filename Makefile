.PHONY: dev setup db build api lambda front stop sync sync-server backup restore backups

# 初回だけ: 依存インストール + ローカル設定ファイルの作成（既にあれば上書きしない）
setup:
	cd backend && npm install
	cd frontend && npm install
	@test -f sam/local-env.json || cp sam/local-env.sample.json sam/local-env.json
	@test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local

# DB起動（healthcheckが通るまで待つ）
db:
	docker compose up -d --wait

build:
	cd sam && sam build

api:
	cd sam && sam local start-api --env-vars local-env.json

lambda:
	cd sam && sam local start-lambda --env-vars local-env.json

front:
	cd frontend && npm run dev

# ローソク足の同期用ローカルサーバー（トレード画面の「ローソク足を更新」ボタンを受ける）。
# アプリ本体のコンテナからは手元のMT5のCSVを読めないため、Macで直接動かす
sync-server:
	cd backend && npm run sync:server

# ボタンを使わずに、コマンドで直近7日分を同期したいとき（ボタンは登録済みトレードの時間帯だけを取り込む）
sync:
	cd backend && npm run candles:sync -- --days 7

# 毎回これだけ: DB起動 → ビルド → api / lambda / frontend / 同期サーバーを同時起動（止めるときは Ctrl+C）
dev: db build
	@./script/backup-db.sh || echo "警告: 起動前のバックアップに失敗しました（起動は続けます）"
	$(MAKE) -j4 api lambda front sync-server

# DBコンテナを止める（止める前に自動でバックアップ。データはボリュームに残る）
stop:
	@./script/backup-db.sh || echo "警告: バックアップに失敗しました（DBは止めます）"
	docker compose stop

# DBを丸ごとバックアップ（既定は ./backups/。別の場所にしたいときは BACKUP_DIR=~/Dropbox/fx make backup）
backup:
	./script/backup-db.sh

# バックアップの一覧（新しい順）
backups:
	@ls -lht $${BACKUP_DIR:-backups}/*.sql.gz 2>/dev/null || echo "バックアップはまだありません"

# 復元: make restore FILE=backups/fx-review_20261025_180000.sql.gz （FILE=latest で最新）
restore:
	@test -n "$(FILE)" || { echo "使い方: make restore FILE=backups/<ファイル>.sql.gz  （最新なら FILE=latest）"; exit 1; }
	@if [ "$(FILE)" = "latest" ]; then ./script/restore-db.sh --latest; else ./script/restore-db.sh "$(FILE)"; fi
