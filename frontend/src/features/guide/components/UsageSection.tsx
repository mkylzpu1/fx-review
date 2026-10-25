import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { Callout, Code, GuideSection, GuideSteps } from "./GuideParts";

/** 使い方: 記録 → チャートで見返す → 統計 → AIで分析 → ルール化 */
export function UsageSection() {
  return (
    <GuideSection
      id="usage"
      title="2. 使い方"
      lead="記録して、チャートで見返して、AIに分析してもらい、ルールに戻す。この一周が基本の流れです。"
    >
      <GuideSteps>
        <li>
          <b>トレードを記録する。</b>
          楽天FX証券の約定履歴CSVは、
          <Link to={ROUTES.TRADE_IMPORT} className="text-accent-link underline">
            トレードの取り込み
          </Link>
          で、複数ファイルをまとめて入れられます（①選ぶ → ②確認 →
          ③取り込む）。手で入れるときは「トレードを記録」から、方向・ロット・エントリー日時と価格だけを入力します。SL・TP・根拠・感情などは、すべて任意です。
        </li>
        <li>
          <b>チャートで見返す。</b>
          トレード詳細で、エントリー時点の1m・5m・15m・1h・4h・1日足を切り替え、EMAを重ねて見られます。
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-sub">
            <li>
              キー操作: <Code>1〜6</Code> 時間足 / <Code>A</Code>{" "}
              エントリー後の値動きの表示・非表示 / <Code>D</Code> 2画面 /{" "}
              <Code>← →</Code> 前後のトレード
            </li>
            <li>
              足が出ない・古いときは、先に
              <a href="#candles" className="text-accent-link underline">
                ローソク足の更新
              </a>
              をします。
            </li>
          </ul>
        </li>
        <li>
          <b>計画・ルール・振り返りを書く。</b>
          右側のタブに、計画と結果、ルールを守れたか、振り返りを残します。ルールは
          <Link to={ROUTES.RULES} className="text-accent-link underline">
            ルール
          </Link>
          で作ります。
        </li>
        <li>
          <b>統計と週次レビューを見る。</b>
          <Link to={ROUTES.STATS} className="text-accent-link underline">
            統計
          </Link>
          で勝率・損益・ルール遵守を確認し、週ごとの振り返りもできます。
        </li>
        <li>
          <b>AIに分析してもらう。</b>
          <Link to={ROUTES.EXPORT} className="text-accent-link underline">
            エクスポート
          </Link>
          で期間と項目を選んで、コピーまたはダウンロードし、AIに貼り付けて「どう改善すべきか」を聞きます。
        </li>
        <li>
          <b>改善案をルールにして検証する。</b>
          AIの回答から取り出した改善案を
          <Link to={ROUTES.NOTES} className="text-accent-link underline">
            学習メモ
          </Link>
          と
          <Link to={ROUTES.RULES} className="text-accent-link underline">
            ルール
          </Link>
          に残し、次の10件で効果を確かめます。
        </li>
        <li>
          <b>人に見せる（任意）。</b>
          トレード画面の「公開してURLを作る」で、評価用ファイルのURLを作れます。Cloudflareの設定が済んでいて、ローカル起動のときだけ使えます。24時間で自動的に消えます。
        </li>
      </GuideSteps>

      <Callout title="データのバックアップ">
        設定画面の「データ」のJSONは、自分のトレードと設定だけが対象で、ローソク足は含みません。ローソク足も含めて守るときは{" "}
        <Code>make backup</Code> を使います。
      </Callout>
    </GuideSection>
  );
}
