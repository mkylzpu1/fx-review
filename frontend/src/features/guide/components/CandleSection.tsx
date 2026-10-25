import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { Callout, Code, GuideSection, GuideSteps } from "./GuideParts";

/** ローソク足の更新が必要なこと（自動では取り込まれない） */
export function CandleSection() {
  return (
    <GuideSection
      id="candles"
      title="3. ローソク足の更新が必要です"
      lead="チャートの足は、自動では最新になりません。MT5から取り込む操作を、自分で行います。"
    >
      <Callout tone="caution" title="押し忘れると、古い足のままです">
        新しいトレードを取り込んだあと、また、チャートに足が出ない・足が古いときは、次の2手順で更新します。
      </Callout>

      <GuideSteps>
        <li>
          MT5のチャートで「<b>CSV書き出し</b>
          」ボタンを押します（EAが最新の1分足をCSVに書き出します）。
        </li>
        <li>
          アプリのチャート画面の操作バーにある「<b>足を更新</b>」を押します。
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-sub">
            <li>トレード詳細: そのトレードの時間帯だけを更新します。</li>
            <li>トレード一覧: 全トレードの時間帯をまとめて更新します。</li>
          </ul>
        </li>
      </GuideSteps>

      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          同じ足を何度取り込んでも重複しません。直近48時間は最新の値で上書きされ、それより古い足は変わりません。
        </li>
        <li>
          形成中の最後の1本は含まれません。確定した足だけが取り込まれます。
        </li>
        <li>
          書き出しは直近180日分です。それより古いトレードの足は、MT5側に残っていれば、EAの{" "}
          <Code>InpDays</Code> を増やして書き出し直します。
        </li>
        <li>
          更新が終わると、取り込んだ期間の最大含み益・最大含み損（MFE/MAE）も計算し直されます。
        </li>
      </ul>

      <Callout title="うまくいかないとき">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            「取り込める足がありませんでした」:
            MT5の「CSV書き出し」を先に押したか、<Code>CANDLE_CSV_DIR</Code>{" "}
            のフォルダが合っているかを確認します。
          </li>
          <li>
            「同期サーバーに接続できません」: <Code>make dev</Code>{" "}
            で起動しているか確認します。ボタンはローカル起動の画面（
            <Code>localhost:5173</Code>
            ）でしか使えません。
          </li>
          <li>
            「足を更新」が押せない:
            ローカル起動以外の画面では、無効になっています。
          </li>
        </ul>
      </Callout>

      <p className="text-sm text-ink-sub">
        足の更新を使わなくても、価格・根拠・結果の記録はできます。足を見たいときだけ更新してください。{" "}
        <Link to={ROUTES.TRADES} className="text-accent-link underline">
          トレード一覧を開く
        </Link>
      </p>
    </GuideSection>
  );
}
