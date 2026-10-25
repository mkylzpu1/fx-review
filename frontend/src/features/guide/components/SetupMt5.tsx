import { Callout, Code, CodeBlock, Step, StepList } from "./GuideParts";

export const MT5_STEPS = [
  "mt5-copy",
  "mt5-compile",
  "mt5-attach",
  "mt5-export",
  "mt5-env",
];

/** 1-B. MT5を設定する */
export function SetupMt5() {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">B. MT5を設定する</h3>
      <p className="text-base leading-relaxed text-ink-sub">
        ローソク足の元データは、MT5から取り出します。専用の小さなプログラム（EA）を入れると、チャートに
        「CSV書き出し」ボタンが出ます。
      </p>
      <StepList>
        <Step id="mt5-copy" no={1} title="EAのファイルをMT5に置く">
          <p>
            MT5のメニュー「<b>ファイル → データフォルダを開く</b>」を押し、
            <Code>MQL5 → Experts</Code> のフォルダに、アプリの{" "}
            <Code>mt5/FxReviewExport.mq5</Code> をコピーします。
          </p>
        </Step>
        <Step id="mt5-compile" no={2} title="コンパイルする">
          <p>
            コピーしたファイルをダブルクリックしてMetaEditorで開き、
            <Code>F7</Code> を押します。下の欄に「エラー 0」と出れば成功です。
          </p>
        </Step>
        <Step id="mt5-attach" no={3} title="USDJPYのチャートにEAを付ける">
          <p>
            USDJPYのチャートを開き、左の「ナビゲーター」の「エキスパートアドバイザ」から{" "}
            <Code>FxReviewExport</Code> をチャートへドラッグします。
          </p>
          <p>
            設定画面で「<b>アルゴリズム取引を許可</b>
            」にチェックを入れて、OKを押します。チャートの左上に青い「CSV書き出し」ボタンが出れば成功です。
          </p>
        </Step>
        <Step id="mt5-export" no={4} title="「CSV書き出し」を1回押す">
          <p>
            直近180日分の1分足が、CSVファイルになります。MT5の「ファイル →{" "}
            <b>共通データフォルダを開く</b>
            」で開く場所の中に、次のファイルができていれば成功です。
          </p>
          <CodeBlock>{`Files/fx-review/USDJPY_M1.csv`}</CodeBlock>
        </Step>
        <Step id="mt5-env" no={5} title="CSVの置き場所を、アプリに教える">
          <p>
            アプリのフォルダにある <Code>backend/.env.local</Code>{" "}
            を開き、次の1行を足します。右側は、手順4で見つけた{" "}
            <Code>fx-review</Code> フォルダの場所です。
          </p>
          <CodeBlock>{`CANDLE_CSV_DIR=（共通データフォルダの場所）/Files/fx-review`}</CodeBlock>
          <p>
            書いたら、<Code>make dev</Code> を一度止めて、もう一度起動します。
          </p>
        </Step>
      </StepList>
      <Callout tone="caution" title="足の時刻がずれて見えるとき">
        <p>
          お使いの口座のサーバー時刻に合わせます。
          <Code>backend/.env.local</Code> の <Code>MT5_SERVER_TIME</Code>
          （何も書かなければ <Code>ny-close</Code> ）を書き換えます。
        </p>
        <p>
          証券会社によって銘柄名が違う場合は、EAを付けるときの設定の{" "}
          <Code>InpSymbol</Code> を、その名前に合わせます。
        </p>
      </Callout>
    </div>
  );
}
