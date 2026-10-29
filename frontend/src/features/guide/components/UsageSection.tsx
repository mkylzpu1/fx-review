import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { Callout, Code, GuideSection, Step, StepList } from "./GuideParts";

const LINK = "font-bold text-accent-link underline";

/** 公開サイト（LPとガイドだけ）ではアプリ本体の画面に飛べないので、リンクにせず太字にする */
const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === "1";

function AppLink({ to, children }: { to: string; children: ReactNode }) {
  if (PUBLIC_SITE) return <b>{children}</b>;
  return (
    <Link to={to} className={LINK}>
      {children}
    </Link>
  );
}
export const USAGE_STEPS = [
  "use-record",
  "use-chart",
  "use-review",
  "use-stats",
  "use-ai",
  "use-rule",
];

/** 2. 使い方 */
export function UsageSection() {
  return (
    <GuideSection
      id="usage"
      eyebrow="STEP 2"
      title="使い方"
      lead="記録する → チャートで見返す → AIに相談する → ルールに戻す。この一周が、基本の流れです。"
      stepIds={USAGE_STEPS}
    >
      <StepList>
        <Step id="use-record" no={1} title="トレードを記録する">
          <p>
            楽天FX証券の約定履歴CSVは、まとめて取り込めます。
            <AppLink to={ROUTES.TRADE_IMPORT}>CSVを取り込む</AppLink>
            を開き、「①ファイルを選ぶ → ②内容を確認 → ③取り込む」と進みます。
          </p>
          <p>
            手で入れるときは、右上の「トレードを記録」から。
            <b>必須なのは、方向・ロット・エントリー日時・価格だけ</b>
            です。SL・TP・根拠・感情は、書けるときだけで大丈夫です。
          </p>
        </Step>
        <Step id="use-chart" no={2} title="チャートで、エントリーを見返す">
          <p>
            トレードを開くと、エントリーしたときのチャートが見られます。1分足から日足まで切り替えて、EMAも重ねられます。
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Code>1</Code>〜<Code>6</Code>：時間足を切り替える
            </li>
            <li>
              <Code>A</Code>：エントリー後の値動きを出す／隠す
            </li>
            <li>
              <Code>D</Code>：チャートを2画面にする
            </li>
            <li>
              <Code>←</Code> <Code>→</Code>：前後のトレードへ
            </li>
          </ul>
          <p>
            足が出ない・古いときは、
            <a href="#candles" className={LINK}>
              ローソク足の更新
            </a>
            をします。
          </p>
        </Step>
        <Step id="use-review" no={3} title="計画・ルール・振り返りを書く">
          <p>
            トレード詳細の右側のタブに、計画と結果、ルールを守れたか、振り返りを残します。ルールは、
            <AppLink to={ROUTES.RULES}>ルール</AppLink>
            の画面で作ります。
          </p>
        </Step>
        <Step id="use-stats" no={4} title="統計で、自分のクセを見る">
          <p>
            <AppLink to={ROUTES.STATS}>統計</AppLink>
            で、勝率・損益・ルールの守れた度合いを確認します。週ごとの振り返りも、ここから開けます。
          </p>
        </Step>
        <Step id="use-ai" no={5} title="AIに「どう改善する？」と聞く">
          <p>
            <AppLink to={ROUTES.EXPORT}>エクスポート</AppLink>
            で、期間と含める項目を選び、「コピー」を押します。AIの入力欄に貼り付けて、改善点を聞きます。
          </p>
        </Step>
        <Step id="use-rule" no={6} title="改善案をルールにして、10件で確かめる">
          <p>
            AIの答えから使えるものを選び、
            <AppLink to={ROUTES.NOTES}>学習メモ</AppLink>と
            <AppLink to={ROUTES.RULES}>ルール</AppLink>
            に残します。次の10件のトレードで、効果があったかを確かめます。
          </p>
        </Step>
      </StepList>
      <Callout title="人に評価してもらいたいとき">
        <p>
          トレード画面の「公開してURLを作る」を押すと、評価用のURLができます。24時間で自動的に消えます（Cloudflareの設定が必要です）。
        </p>
      </Callout>
      <Callout title="データのバックアップ">
        <p>
          設定画面の「データ」のJSONは、自分のトレードと設定だけです。ローソク足も含めて守るときは、ターミナルで{" "}
          <Code>make backup</Code> を使います。
        </p>
      </Callout>
    </GuideSection>
  );
}
