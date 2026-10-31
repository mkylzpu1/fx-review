import type { BlogWarning, DayBundle, Manifest } from "./bundleSchema";
import { addDays, daysInclusive, isWeekRange } from "./dateUtils";

/** zip直下に置く、Claude向けの指示書のファイル名（最初に読ませるため先頭に並ぶ名前） */
export const INSTRUCTIONS_FILE = "00_READ_ME_FIRST.md";

/** 投稿先のブログ（週次記事JSONを受け取る側） */
export const BLOG_REPO = "mkylzpu1/fx-blog";

const WARNING_LABEL: Record<BlogWarning["code"], string> = {
  candles_missing: "ローソク足なし（画像なし）",
  memo_missing: "根拠メモ未入力",
  open_trade: "未決済",
  image_failed: "画像の生成に失敗",
};

export interface InstructionsInput {
  manifest: Manifest;
  days: readonly DayBundle[];
  zipFileName: string;
}

const imageCountOf = (d: DayBundle) =>
  d.trades.reduce(
    (n, t) => n + Object.values(t.charts).filter((p) => p !== null).length,
    0,
  );

/**
 * このzipを受け取ったClaudeへの指示書。
 * 期間・件数・コマンドなど、今回の書き出しに固有の値を埋め込む。
 * 契約（day.json / manifest.json）には含めない、zipに同梱するだけの補助ファイル。
 */
export function buildInstructions(i: InstructionsInput): string {
  const { manifest: m, days } = i;
  const { from, to } = m.range;
  const publishDate = addDays(to, 1);
  const span = daysInclusive(from, to);
  const tradeCount = days.reduce((n, d) => n + d.trades.length, 0);
  const imageCount = days.reduce((n, d) => n + imageCountOf(d), 0);

  const weekNotice = isWeekRange(from, to)
    ? ""
    : [
        "",
        `> **注意**: この期間（${from}〜${to}、${span}日間）は、月曜〜日曜の1週間ではありません。`,
        "> ブログは「1記事 = 1週間分」です。意図した期間か、作業を始める前にユーザーに確認してください。",
        "> 確認が取れない場合は、このまま1記事として作り、PR本文にこの点を書いてください。",
      ].join("\n");

  const dayRows = days
    .map((d) => `| ${d.date} | ${d.trades.length} | ${imageCountOf(d)} |`)
    .join("\n");

  const warnings = m.warnings.length
    ? m.warnings
        .map(
          (w) =>
            `- ${w.date}${w.seq !== null ? ` #${w.seq}` : ""} 【${WARNING_LABEL[w.code]}】${w.message}`,
        )
        .join("\n")
    : "- なし";

  return `# このzipを受け取ったら: FXブログの週次記事を1本作って投稿する

このzip（\`${i.zipFileName}\`）は、FXトレードの振り返りアプリ「とれみる」から書き出した、**1週間分のトレードデータ**です。
このファイルだけ読めば作業できるように書いてあります。最初に最後まで読んでから始めてください。

## 何を作るか

- **1週間のトレード = 1記事**（週次記事JSONを1つ作る）。
- 投稿先リポジトリ: \`${BLOG_REPO}\`（Astro製の静的ブログ）。
- 数字（pips・損益・勝敗など）とチャート画像は、データから**機械的に**ブログへ出ます。**あなたが書くのは文章だけ**です。
- 完成したものは、\`${BLOG_REPO}\` にブランチをpushして、PRを作ります（\`main\` は保護されているため、直接pushしません）。マージされると自動で公開されます。
${weekNotice}

## 今回の入力

- 期間: **${from} 〜 ${to}**（${span}日間）
- 取引があった日: ${days.length}日 / トレード ${tradeCount}件 / チャート画像 ${imageCount}枚
- タイムゾーン: ${m.timezone}
- 未決済を含む: ${m.includesOpenTrades ? "含む" : "含まない"}
- 公開日（JST）: ユーザーから指定が無ければ **${publishDate}**（最終日の翌日）

| 日付 | トレード数 | 画像数 |
| --- | --- | --- |
${dayRows}

## このzipの中身と、ブログ側の置き場所

| zip内 | \`${BLOG_REPO}\` での置き場所 | 扱い |
| --- | --- | --- |
| \`manifest.json\` | （置かない） | 期間・日付一覧・警告。取り込み時の検証に使う |
| \`days/<日付>/day.json\` | \`src/data/days/<日付>.json\` | そのままコピー。**数字の唯一の出どころ。書き換えない** |
| \`days/<日付>/charts/NN_<通貨ペア>_<時間足>.png\` | \`src/assets/posts/<日付>/NN_<通貨ペア>_<時間足>.webp\` | 幅1280・品質80のWebPに変換 |
| （新しく作る） | \`src/content/weeks/${from}.json\` | **週次記事JSON。あなたが文章を書くのはこれだけ** |
| \`${INSTRUCTIONS_FILE}\` | （置かない） | このファイル |

ファイル名は期間の最初の日（\`${from}\`）にします。コピー・変換・雛形づくりは、ブログ側の取り込みスクリプトが自動でやります（下の手順2）。

## 手順

1. \`${BLOG_REPO}\` をcloneして、\`npm ci\` を実行する（Nodeは \`.nvmrc\` のバージョン）。
   **最初に \`docs/article-guidelines.md\` を読む。** 記事のルールの正はそのファイルです。このファイルと食い違ったら、ブログ側を優先してください。
2. このzipを取り込む:
   \`\`\`bash
   node scripts/import-bundle.mjs ${i.zipFileName} --publish-date ${publishDate}
   \`\`\`
   \`src/data/days/\`・\`src/assets/posts/\` が埋まり、\`src/content/weeks/${from}.json\` の**雛形**ができます。
   契約の \`schemaVersion\` が違うときは、スクリプトが理由を出して止まります。その場合は中身を推測せず、ユーザーに伝えてください。
3. 雛形の \`TODO\` と書かれた項目**だけ**を、下のルールに従って文章に書き換える。キーの追加・削除・名前の変更はしない。
4. 検証して、通るまで直す:
   \`\`\`bash
   node scripts/validate-content.mjs
   npx astro check
   \`\`\`
5. ブランチ \`week/${from}\` へpushして、PRを作る。PR本文は \`.github/pull_request_template.md\` に沿って書き、下の「メモ未入力の一覧」を貼る。

push権限が無いときは、ユーザーに \`${BLOG_REPO}\` 1つだけを対象にしたトークンを依頼してください。トークンを記事・コミット・PR本文・ログに出さないこと。

## 週次記事JSONのルール（要点）

- **1ファイル = 1週間 = 1記事。** キーは固定で、余分なキーはCIで失敗します。形は \`docs/week.schema.json\` です。
- \`days\` は、取引があった日だけ、日付の古い順。その日の全トレードを \`seq\` 順に**漏れなく**書く。
- 1トレードの文章は固定の5項目です。

| キー | 内容 | 書いてよい条件 |
| --- | --- | --- |
| \`fact\` | 事実の一文（売買の向き・時刻・結果の方向だけ） | 常に書く |
| \`reason\` | エントリー根拠 | その日の \`day.json\` の \`rationaleMemo\` がある時だけ。無ければ \`null\` |
| \`riskNote\` | 損切り・利確の理由 | \`slReason\` / \`tpReason\` のどちらかがある時だけ。無ければ \`null\` |
| \`review\` | 振り返りの気づき | \`insight\` がある時だけ。無ければ \`null\` |
| \`nextRule\` | 次のルール | \`nextRule\` がある時だけ。無ければ \`null\` |

- **メモが無い（\`null\`の）項目に、理由や心境を創作しない。** \`null\` のままにします。メモがあるときは、その内容を言い換えるだけで、メモに無いことを足しません。
- 文章に数字（pips・円・R・価格・勝率・件数）を直接書かない。「最初のトレード」「2件目」のように言葉で書く。
- \`title\`（60字まで）、\`description\`（120字まで）、\`intro\`（その週の一言）、\`closing\`（締めの一言）、各日の \`headline\`、\`weekReview\`（\`good\` / \`improve\` / \`nextWeekRules\`）も、あなたが書く。
- 売買の推奨・断定・利益の保証・勧誘をしない。禁止表現は \`scripts/content-rules.json\`。
- 読者は「FXを勉強中で、なかなか勝てない人」。失敗を隠さず、責めず、学びにつなげる。
- チャート画像に口座残高などが写っていないか確認する。

## メモ未入力・警告の一覧

PR本文に貼ってください。

${warnings}

## 終わったら、ユーザーに伝えること

- PRのリンク
- 公開日（JST）と、\`draft\` かどうか
- 上の警告のうち、記事に影響したもの（メモ未入力で \`null\` にした項目など）
`;
}
