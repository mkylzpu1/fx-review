import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

/** バックアップ・復元・全削除は P5 で実装する（それまで操作は無効） */
export function DataSection() {
  const rows = [
    {
      title: "バックアップを保存",
      desc: "トレード・ルール・メモ・設定をまとめてJSONで保存します。",
      label: "JSONを保存",
    },
    {
      title: "バックアップから復元",
      desc: "保存したJSONを読み込みます。いまのデータは置き換わります。",
      label: "ファイルを選ぶ",
    },
    {
      title: "MT5の履歴を取り込む",
      desc: "準備中です。",
      label: "準備中",
    },
  ];
  return (
    <section id="data" className="card">
      <h2 className="text-base font-bold">データ</h2>
      <p className="mt-1 text-xs text-ink-mute">
        AIに渡すためのまとめ出力は{" "}
        <Link to={ROUTES.EXPORT} className="text-accent-link underline">
          エクスポート
        </Link>{" "}
        から行います。
      </p>
      <ul className="mt-3 divide-y divide-line">
        <li className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-bold">楽天FX証券のCSVを取り込む</p>
            <p className="text-xs text-ink-mute">
              約定履歴から、トレードをまとめて登録します。
            </p>
          </div>
          <Link className="btn shrink-0" to={ROUTES.TRADE_IMPORT}>
            取り込み画面へ
          </Link>
        </li>
        {rows.map((r) => (
          <li
            key={r.title}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div>
              <p className="text-sm font-bold">{r.title}</p>
              <p className="text-xs text-ink-mute">{r.desc}</p>
            </div>
            <button className="btn shrink-0" disabled title="準備中">
              {r.label}
            </button>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-bold text-loss">すべてのデータを削除</p>
            <p className="text-xs text-ink-mute">
              トレードと、ルール・メモ・設定を消します。元に戻せません。
            </p>
          </div>
          <button className="btn-danger shrink-0" disabled title="準備中">
            削除する
          </button>
        </li>
      </ul>
    </section>
  );
}
