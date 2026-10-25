# 評価用ファイルの公開（Cloudflare Workers + KV）

トレード画面の「公開してURLを作る」で、評価用のHTMLをCloudflareに置き、**24時間たつと自動で消える**URLを作ります。
無料の範囲で動きます（KV: 読み取り1日10万回・書き込み1日1,000回・保存1GB まで）。

仕組み: アプリ（手元の同期サーバー）が、CloudflareのAPIで KV に保存（24時間で消える設定）→
このWorkerが `https://…workers.dev/s/{ランダムなID}` で取り出して見せる。

## 最初に1回だけ（ダッシュボードで作る場合）

1. [Cloudflare](https://dash.cloudflare.com/) の無料アカウントを作る。
2. **KVの入れ物を作る**: 左メニュー「Storage & Databases」→「KV」→「Create」→ 名前は `fx-review-share`。
   作ったあと、**Namespace ID** を控える。
3. **Workerを作る**: 「Workers & Pages」→「Create」→「Hello World」から作り、名前は `fx-review-share`。
   - 「Edit code」で、`cloudflare/share-worker/src/index.js` の中身を貼り付けて保存（Deploy）。
   - Worker の「Settings → Bindings → Add → KV namespace」で、
     Variable name を **`SHARES`**、KV namespace を 2. で作ったものにして保存。
   - Worker の URL（`https://fx-review-share.〇〇.workers.dev`）を控える。
4. **APIトークンを作る**: 右上のアイコン →「My Profile」→「API Tokens」→「Create Token」→「Create Custom Token」。
   権限は **Account → Workers KV Storage → Edit** の1つだけ。Account Resources は自分のアカウントだけにする。
   表示されたトークンを控える（**この画面を閉じると二度と見られません**）。
5. **Account ID** を控える（ダッシュボードの右側、または Workers & Pages の画面）。
6. `backend/.env.local` に書く（このファイルはGitに入りません）:

   ```
   CF_ACCOUNT_ID=（5のID）
   CF_KV_NAMESPACE_ID=（2のID）
   CF_API_TOKEN=（4のトークン）
   SHARE_BASE_URL=https://fx-review-share.〇〇.workers.dev
   ```
7. `make dev` を起動し直す（起動時に「評価用の公開: 使えます」と出れば準備完了）。

## wrangler（コマンド）で作る場合

```
cd cloudflare/share-worker
npx wrangler kv namespace create SHARES     # 出てきた id を wrangler.toml に貼る
npx wrangler deploy
```
APIトークンと `.env.local` は、上の4・5・6と同じです。

## LINE・Slack などで送ったときのプレビュー

URLを貼ると、アプリ名の画像（`/og.png`）と、トレードの題名・説明が出ます。
画像とアイコンは Worker の中（`src/index.js` の `ASSETS`）に入っているので、別のファイルを置く設定は要りません。

- 出るのは、題名（通貨ペア・売買・日時）と固定の説明だけです。損益額・振り返り・メモは出ません。
- **この機能を入れる前に作ったURLは、プレビューが出ません**（保存済みのファイルにタグが無いため）。公開し直してください。
- **Worker は、`src/index.js` を貼り直して Deploy し直す必要があります**（ダッシュボードの「Edit code」）。
- LINE は、一度作ったプレビューを覚えます。同じURLで画像が変わらないときは、別の公開（新しいURL）で確かめてください。
- 確認: `https://（WorkerのURL）/og.png` をブラウザで開いて、画像が出ればWorkerは更新できています。

## 動作確認（任意）

トークンが正しいか、先にコマンドで確かめられます（書き込みと読み出しと削除）:

```
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/storage/kv/namespaces/$CF_KV_NAMESPACE_ID/values/test-key?expiration_ttl=60" \
  -H "Authorization: Bearer $CF_API_TOKEN" -F "value=hello" -F "metadata={}"
```

## 注意

- **URLを知っている人は、誰でも見られます。** ログインはありません。IDは192ビットの乱数で、推測はほぼ不可能ですが、LINEなどで転送されれば誰にでも見られます。
- 評価用ファイルには、価格・日時・（チェックしたときだけ）根拠メモが入ります。損益額・口座・感情タグ・振り返りの記述は入りません。
- 消えるのは、保存から24時間後に、KVが自動で行います。秒単位ではなく、前後することがあります。
- 公開した直後は、世界中のサーバーに行き渡るまで、数十秒ほど開けないことがあります（KVの仕組み）。
- APIトークンは、KV の書き込み権限だけに絞ってください。漏れたら、ダッシュボードですぐ削除して作り直します。
