import type { ReactNode } from "react";
import { ShowChart } from "./ShowChart";
import { ShowExport } from "./ShowExport";
import { ShowImport } from "./ShowImport";
import { ShowRules } from "./ShowRules";
import { ShowStats } from "./ShowStats";
import { ShowWeekly } from "./ShowWeekly";

interface Feature {
  id: string;
  title: ReactNode;
  lead: string;
  points: string[];
  ui: ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: "import",
    title: "CSVを選ぶだけで、記録がそろう。",
    lead: "楽天FX証券の約定履歴CSVから、トレードをまとめて登録します。注文履歴CSVを重ねれば、SL・TPも入ります。",
    points: [
      "取り込み済みの約定は重複せず、スキップか上書きを選べる",
      "SLが入ると、R（損失幅を1とした損益）まで自動で計算",
      "保存前に、SL・TPからRRと想定リスクを確認できる",
    ],
    ui: <ShowImport />,
  },
  {
    id: "chart",
    title: "決済のあと、どうなったかまで見える。",
    lead: "MT5の1分足の上に、エントリー・TP・SL・決済を線で再現。保有中の最大含み益・含み損と、決済後に伸びた幅も出ます。",
    points: [
      "凡例を押すだけで、線ごとに表示・非表示を切り替え",
      "EMAを重ねて、そのときの相場の流れも確認",
      "共有したいチャートは、24時間で消えるURLで相手に見せられる",
    ],
    ui: <ShowChart />,
  },
  {
    id: "rules",
    title: "決めたルールを、守れたか確かめる。",
    lead: "ルールは、記録するときの発注前チェックになります。守れなかった記録には警告が出て、守った時と破った時の成績が並びます。",
    points: [
      "ルールごとに、遵守率の週次推移と、破ったトレードの一覧を確認",
      "改善案はルール化して、10件たまったら前後の成績を比較",
    ],
    ui: <ShowRules />,
  },
  {
    id: "stats",
    title: "勝ちやすい条件と、負けやすい条件がわかる。",
    lead: "勝率・PF・平均R・最大連敗に加えて、セッション・根拠タグ・曜日・時間帯・保有時間・ロット別に平均Rを集計します。",
    points: [
      "15件以上ある区分は、強み・弱みを判定",
      "今日・30日・90日・今月・すべてで期間を切り替え",
      "SLがなくRが出せない記録は、「R未計算」として別に数える",
    ],
    ui: <ShowStats />,
  },
  {
    id: "weekly",
    title: "1週間を、数字と感情で振り返る。",
    lead: "日別のRと、ルールを守れた割合。TPまで持たずに手動で決済した分を、計画どおりにしていたらどうだったかも並べて見られます。",
    points: ["そのときの感情タグも一緒に集計", "週ごとに、コメントを残せる"],
    ui: <ShowWeekly />,
  },
  {
    id: "ai",
    title: "記録を渡して、改善点をAIに聞く。",
    lead: "期間と項目を選んで、Markdown・CSV・JSONで出力。貼り付けるだけで、AIが記録全体を見て分析できます。",
    points: [
      "結果・計画との差・根拠・ルール遵守・感情・市場状況を、項目ごとに選べる",
      "コピーも、ダウンロードもできる",
    ],
    ui: <ShowExport />,
  },
];

const MORE: [string, string][] = [
  [
    "未入力のトレードがひと目でわかる",
    "SL・TP未入力、根拠なし、未決済で絞り込み。入力の進み具合も出ます。",
  ],
  [
    "感情と確信度を残せる",
    "記録のたびにタグで残せて、統計やエクスポートにも反映されます。",
  ],
  [
    "学習メモを、ルールに育てる",
    "気づきを「要検証」の改善案にして、固まったらルール化します。",
  ],
  [
    "見返す順番に迷わない",
    "取り込み → 足の更新 → 見返す。ご利用ガイドに手順がそろっています。",
  ],
];

/** 実際の画面（再現）で、できることを順に見せる */
export function Showcase() {
  return (
    <section id="showcase" className="lp-show" aria-labelledby="show-h">
      <header className="lp-show-head">
        <h2 id="show-h">実際の画面で、見てください。</h2>
        <p>
          ここに並ぶのは、アプリの画面と同じ作りの見本です。ボタンや凡例は、押して確かめられます。
        </p>
      </header>

      {FEATURES.map((f) => (
        <article key={f.id} className="lp-feat">
          <div className="lp-feat-text">
            <h3>{f.title}</h3>
            <p>{f.lead}</p>
            <ul>
              {f.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="lp-feat-ui">{f.ui}</div>
        </article>
      ))}

      <div className="lp-more">
        <h3>ほかにも、振り返りを続けやすく。</h3>
        <ul>
          {MORE.map(([t, d]) => (
            <li key={t}>
              <b>{t}</b>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
