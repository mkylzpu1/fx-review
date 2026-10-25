import {
  Callout,
  Code,
  CodeBlock,
  GuideSection,
  GuideSteps,
} from "./GuideParts";

/** セットアップ: ローカル起動 → MT5 → Cloudflare（任意） */
export function SetupSection() {
  return (
    <GuideSection
      id="setup"
      title="1. セットアップ"
      lead="最初に1回だけ行います。ローカル起動 → MT5 → Cloudflare（任意）の順です。"
    >
      <Callout title="このアプリは、手元のPCでだけ動かします">
        公開サーバーには置きません。データベース（Docker）、API、画面、MT5のデータを読む同期サーバーはすべて自分のPCで動きます。
        そのため「足を更新」は <Code>make dev</Code>{" "}
        で起動した画面からしか使えません。
      </Callout>

      <div className="space-y-2">
        <h3 className="text-base font-bold">1-1. ローカルで起動する</h3>
        <p className="text-sm text-ink-sub">
          Node.js 20以上、npm 10以上、Docker、AWS SAM CLI
          を入れてから、次の2つを実行します。
        </p>
        <CodeBlock>{`make setup   # 初回だけ: 依存のインストールと設定ファイルの作成
make dev     # 毎回: DB → API → 画面（5173）→ 同期サーバー（3100）を起動`}</CodeBlock>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            ブラウザで <Code>http://localhost:5173</Code>{" "}
            を開きます。ローカルでは固定ユーザーで入れるので、ログイン設定は不要です。
          </li>
          <li>
            止めるときは <Code>Ctrl+C</Code>。DBは <Code>make stop</Code>{" "}
            で止めます（止める前に自動でバックアップを取ります）。
          </li>
          <li>
            DB全体（ローソク足を含む）のバックアップは <Code>make backup</Code>
            、復元は <Code>make restore FILE=latest</Code> です。
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold">1-2. MT5を設定する</h3>
        <p className="text-sm text-ink-sub">
          チャートの1分足をCSVに書き出す、専用のEA（
          <Code>mt5/FxReviewExport.mq5</Code>
          ）を入れます。書き出されたCSVを、アプリが読み取ります。
        </p>
        <GuideSteps>
          <li>
            MT5の「ファイル → データフォルダを開く」から{" "}
            <Code>MQL5/Experts</Code> を開き、<Code>FxReviewExport.mq5</Code>{" "}
            をコピーします。
          </li>
          <li>
            MetaEditorで開いてコンパイルします（<Code>F7</Code>
            ）。エラーが0件になれば完了です。
          </li>
          <li>
            USDJPYのチャートを開き、ナビゲーターの「エキスパートアドバイザ」からEAをチャートへドラッグします。「アルゴリズム取引を許可」にチェックを入れます。
          </li>
          <li>
            チャート左上に青い「CSV書き出し」ボタンが出ます。押すと、直近180日分の確定した1分足が書き出されます。
          </li>
          <li>
            「ファイル → 共通データフォルダを開く」で開く場所の{" "}
            <Code>Files/fx-review/USDJPY_M1.csv</Code>{" "}
            ができていることを確認します。
          </li>
          <li>
            <Code>backend/.env.local</Code> に、手順5の <Code>fx-review</Code>{" "}
            フォルダのパスを書きます。書いたら <Code>make dev</Code>{" "}
            を起動し直します。
            <CodeBlock>{`CANDLE_CSV_DIR=（共通データフォルダ）/Files/fx-review`}</CodeBlock>
          </li>
        </GuideSteps>
        <Callout tone="caution" title="銘柄名とサーバー時刻に注意">
          証券会社によって銘柄の表記が違う場合は、EAの入力パラメータ{" "}
          <Code>InpSymbol</Code>{" "}
          をその表記に合わせます。足の時刻がずれて見えるときは、
          <Code>backend/.env.local</Code> の <Code>MT5_SERVER_TIME</Code>
          （既定は <Code>ny-close</Code>
          ）をお使いの口座のサーバー時刻に合わせてください。
        </Callout>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold">
          1-3. Cloudflareを設定する（「公開してURLを作る」を使う人だけ）
        </h3>
        <p className="text-sm text-ink-sub">
          トレード画面の評価用ファイルを、24時間で自動的に消えるURLにして人に見せる機能のためです。使わないなら、この手順は飛ばしてかまいません（他の機能は動きます）。
        </p>
        <GuideSteps>
          <li>
            無料のCloudflareアカウントを作り、KVの入れ物を{" "}
            <Code>fx-review-share</Code> という名前で作って、Namespace
            IDを控えます。
          </li>
          <li>
            Workerを作り、<Code>cloudflare/share-worker/src/index.js</Code>{" "}
            の中身を貼ってデプロイします。Bindingsで、変数名 <Code>SHARES</Code>{" "}
            にKVを結び付けます。
          </li>
          <li>
            APIトークンを作ります。権限は「Workers KV Storage:
            編集」だけにします。
          </li>
          <li>
            <Code>backend/.env.local</Code> に4つの値を書き、
            <Code>make dev</Code> を起動し直します。起動時に「評価用の公開:
            使えます」と出れば準備完了です。
            <CodeBlock>{`CF_ACCOUNT_ID=（アカウントID）
CF_KV_NAMESPACE_ID=（KVのID）
CF_API_TOKEN=（手順3のトークン）
SHARE_BASE_URL=https://fx-review-share.〇〇.workers.dev`}</CodeBlock>
          </li>
        </GuideSteps>
        <p className="text-sm text-ink-sub">
          くわしい手順と動作確認のコマンドは{" "}
          <Code>cloudflare/share-worker/README.md</Code> にあります。
        </p>
        <Callout tone="caution" title="URLを知っている人は誰でも見られます">
          ログインはありません。転送されれば誰にでも見られるので、人に見せてよい内容かを確かめてから公開してください。APIトークンは人に見せず、Gitにも入れません。
        </Callout>
      </div>
    </GuideSection>
  );
}
