.PHONY: dev setup db build api lambda front stop sync

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

# ローソク足を直近7日分だけDBに同期する（MT5が書き出したCSVを読む）。
# CSVが無い・MT5が止まっているなどで失敗しても、起動は止めない
sync:
	-cd backend && npm run candles:sync -- --days 7

# 毎回これだけ: DB起動 → ローソク足の同期 → ビルド → api / lambda / frontend を同時起動（止めるときは Ctrl+C）
dev: db sync build
	$(MAKE) -j3 api lambda front

# DBコンテナを止める（データは残る）
stop:
	docker compose stop
