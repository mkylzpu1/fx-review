import {
  Callout,
  Code,
  GuideSection,
  Step,
  StepList,
  Trouble,
} from "./GuideParts";

export const CANDLE_STEPS = ["candle-export", "candle-update"];

/** 3. ローソク足の更新が必要なこと */
export function CandleSection() {
  return (
    <GuideSection
      id="candles"
      eyebrow="STEP 3"
      title="ローソク足の更新が必要です"
      lead="チャートの足は、自動では最新になりません。トレードを取り込んだあとや、足が古いときは、次の2つを自分で行います。"
      stepIds={CANDLE_STEPS}
    >
      <Callout
        tone="caution"
        title="MT5の「CSV書き出し」を押し忘れると、古い足のままです"
      >
        <p>先にMT5で書き出し、そのあとアプリで取り込む。この順番です。</p>
      </Callout>
      <StepList>
        <Step id="candle-export" no={1} title="MT5で「CSV書き出し」を押す">
          <p>
            MT5のUSDJPYチャートの左上にある、青いボタンです。最新の1分足が、CSVに書き出されます。
          </p>
        </Step>
        <Step id="candle-update" no={2} title="アプリで「足を更新」を押す">
          <p>
            チャート画面の操作バーにあります。場所によって、更新される範囲が変わります。
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <b>トレード詳細</b>：そのトレードの時間帯だけ
            </li>
            <li>
              <b>トレード一覧</b>：全トレードの時間帯をまとめて
            </li>
          </ul>
          <p>
            「ローソク足を更新しました」と出れば完了です。同じ足を何度取り込んでも、重複しません。
          </p>
        </Step>
      </StepList>
      <div className="space-y-3">
        <h3 className="text-base font-bold">知っておくと安心なこと</h3>
        <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed">
          <li>
            書き出されるのは、直近180日分の、確定した足だけです（形成中の最新の1本は含みません）。
          </li>
          <li>
            古いトレードの足が要るときは、EAの設定 <Code>InpDays</Code>{" "}
            を増やして、書き出し直します。
          </li>
          <li>
            更新のあと、最大含み益・最大含み損（MFE/MAE）も、自動で計算し直されます。
          </li>
          <li>足がなくても、価格・根拠・結果の記録はできます。</li>
        </ul>
      </div>
      <div className="space-y-3">
        <h3 className="text-base font-bold">うまくいかないとき</h3>
        <Trouble question="「取り込める足がありませんでした」と出る">
          <p>MT5の「CSV書き出し」を、先に押したか確認します。</p>
          <p>
            それでも出るときは、<Code>backend/.env.local</Code> の{" "}
            <Code>CANDLE_CSV_DIR</Code>{" "}
            が、CSVのあるフォルダを指しているか確認し、<Code>make dev</Code>{" "}
            を起動し直します。
          </p>
        </Trouble>
        <Trouble question="「同期サーバーに接続できません」と出る">
          <p>
            ターミナルで <Code>make dev</Code>{" "}
            が動いているか確認します。止まっていたら、もう一度起動します。
          </p>
        </Trouble>
        <Trouble question="「足を更新」のボタンが押せない">
          <p>
            <Code>http://localhost:5173</Code>{" "}
            以外の画面では、ボタンが無効になります。<Code>make dev</Code>{" "}
            で起動した画面を開いてください。
          </p>
        </Trouble>
      </div>
    </GuideSection>
  );
}
