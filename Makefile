.PHONY: dev setup db build api lambda front stop sync sync-server

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

# ローソク足の同期用ローカルサーバー（設定画面の「ローソク足を更新」ボタンを受ける）。
# アプリ本体のコンテナからは手元のMT5のCSVを読めないため、Macで直接動かす
sync-server:
	cd backend && npm run sync:server

# ボタンを使わずに、コマンドで直近7日分を同期したいとき
sync:
	cd backend && npm run candles:sync -- --days 7

# 毎回これだけ: DB起動 → ビルド → api / lambda / frontend / 同期サーバーを同時起動（止めるときは Ctrl+C）
dev: db build
	$(MAKE) -j4 api lambda front sync-server

# DBコンテナを止める（データは残る）
stop:
	docker compose stop
