# セキュリティについて

## 想定している使い方（脅威モデル）

このアプリは **自分のパソコン上で動かす（ローカル完結）** ことを前提にしています。

- 画面（`localhost:5173`）・API（`localhost:3000`）・同期サーバー（`127.0.0.1:3100`）・DB（`127.0.0.1:5433`）は、いずれも手元からだけ使えるようにしています。
- ローカル開発モード（`IS_LOCAL=true`）は **認証を省きます**。インターネットや社内LANに公開しないでください。
  - 本物のAWS Lambda上では `IS_LOCAL=true` でも認証を省かない作りにしてあります。
  - 手元以外の `Host` からのリクエストは拒否します。
- `sam/template.yaml` は手元（`sam local`）専用です。このまま AWS にデプロイしないでください。
- DBの初期パスワード（`postgres` / `postgres`）は手元専用の値です。ポートを外部に公開する設定に変えないでください。
- 評価用ファイルの公開（Cloudflare Workers + KV）は、推測できないURL（192bit乱数）で、24時間で自動的に消えます。URLを知っている人は誰でも見られるため、見せてよい相手にだけ送ってください。

## 秘密情報の扱い

- `backend/.env.local`・`frontend/.env.local`・`sam/local-env.json` は Git に入れません（`.gitignore` 済み）。
- Cloudflare の API トークンは「Workers KV Storage: 編集」だけの権限にしてください。
- AWS の認証情報は GitHub Actions の OIDC と GitHub Secrets で扱い、リポジトリには置きません。

## 脆弱性を見つけたら

公開の Issue には書かず、GitHub の **Security → Report a vulnerability**（非公開の報告）から連絡してください。
