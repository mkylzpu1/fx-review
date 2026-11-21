# 楽天FX WebTrader CSV自動ダウンロード（Hammerspoon）

[Hammerspoon](https://www.hammerspoon.org/) を使って、楽天FX証券 WebTrader の
約定照会・注文照会CSVを自動でダウンロードするスクリプト。

- ホットキー（`cmd+shift+t`）で、約定照会→注文照会の順にCSVをダウンロードフォルダへ保存する
- fx-reviewアプリの「CSV取り込み」画面からも呼び出せる（ローカルHTTPブリッジ）。日付を指定して
  「楽天FXから取得」を押すと、ダウンロードしたCSVの中身をそのままアプリに渡せる

## 導入

1. [Hammerspoon](https://www.hammerspoon.org/) をインストールする
2. `~/.hammerspoon/init.lua` に、このフォルダの `rakuten_fx.lua` を読み込む1行を足す

   ```lua
   dofile(os.getenv("HOME") .. "/path/to/fx-review/hammerspoon/rakuten_fx.lua")
   ```

   （`path/to/fx-review` は、このリポジトリを置いた場所に置き換える）
3. Hammerspoonメニュー → **Reload Config**
4. 初回は、画面収録・アクセシビリティなどの権限をmacOSから求められるので許可する
5. Chromeで楽天FX WebTraderにログインしておく（タブが開いていれば、裏のタブでもよい）

## 使い方

### ホットキーから

1. Chromeで楽天FX WebTraderにログインしておく
2. `cmd+shift+t` を押す
3. 開始日を入力する（例：`2026/11/01`）。終了日は指定しない（当日まで）
4. 約定照会・注文照会の順にCSVが `~/Downloads` に保存される

### fx-reviewアプリから

1. Chromeで楽天FX WebTraderにログインしておく（Hammerspoonが裏で操作する）
2. fx-reviewアプリの「CSV取り込み」画面を開く
3. 「楽天FXから自動取得」で開始日を入れて、約定履歴・注文履歴それぞれのボタンを押す
4. ダウンロードしたCSVがそのままファイル選択として読み込まれる（手でファイルを選ぶ手間がない）

アプリ側は `http://127.0.0.1:17391` にローカルで待ち受けているHammerspoonのHTTPサーバーへ
リクエストする。フロントエンドの設定は `frontend/.env.example` の
`VITE_RAKUTEN_BRIDGE_URL` を参照。`npm run dev`（Viteの開発サーバー）で動かしているときは
既定で有効。本番ビルドで使いたい場合は `frontend/.env.local` に明示的に設定する。

## 仕組み・注意点

- Chromeの実タブをAppleScript（`execute ... javascript`）で操作しているので、Chromeの
  ウィンドウ・タブ構成を大きく変えない（最小化やスペース移動は問題ない）
- ダウンロードは一度に1件まで（同時に複数リクエストが来たら、後から来た方は
  「ほかの取り込みが進行中です」エラーになる）
- ダウンロードしたファイルは、取り込み後 `~/Downloads/rakuten-imported/` に移動される
  （同じファイルを誤って二重に拾わないため）
- 楽天FX WebTraderのタブが見つからない場合は、エラーメッセージを返すだけで、
  Hammerspoon側で勝手にタブを開いたりログインしたりはしない
- `CONFIG.allowedOrigins`（`rakuten_fx.lua` 冒頭）に無いオリジンからのリクエストは拒否する。
  本番ドメインから使いたい場合はここに追加する
