/** トンネル内に浮かべる文字。s は、トンネルの入口からの距離 */
export interface LpSection {
  id: string;
  s: number;
  label: string;
  lines: { text: string; size: number; green?: boolean; outline?: boolean }[];
  caption?: string;
  x: number;
  yaw: number;
}

export const SECTIONS: LpSection[] = [
  {
    id: "hero",
    s: 12,
    label: "FXレビュー",
    lines: [
      { text: "トレードを、", size: 230 },
      { text: "見返す。", size: 340, green: true },
    ],
    caption: "FXトレードの振り返りアプリ",
    x: 0,
    yaw: 0,
  },
  {
    id: "statement",
    s: 28,
    label: "整っていく",
    lines: [
      { text: "ばらばらだった記録が、", size: 128 },
      { text: "ひとつの形に整っていく。", size: 128, green: true },
    ],
    x: 0,
    yaw: 0.05,
  },
  {
    id: "import",
    s: 42,
    label: "取り込む",
    lines: [{ text: "取り込む", size: 330, outline: true }],
    caption: "MT5の約定履歴CSVから、トレードをまとめて登録します。",
    x: -1.6,
    yaw: 0.16,
  },
  {
    id: "review",
    s: 54,
    label: "見返す",
    lines: [{ text: "見返す", size: 330, outline: true }],
    caption:
      "ローソク足のチャートで、エントリーから決済までをあとから振り返ります。",
    x: 1.6,
    yaw: -0.16,
  },
  {
    id: "rules",
    s: 66,
    label: "確かめる",
    lines: [{ text: "確かめる", size: 330, outline: true }],
    caption: "自分で決めたルールを発注前チェックにして、守れたかを残します。",
    x: -1.6,
    yaw: 0.16,
  },
  {
    id: "weekly",
    s: 78,
    label: "週で見る",
    lines: [{ text: "週で見る", size: 330, outline: true }],
    caption: "統計と週次レビューで、勝ち負けの偏りを見つけます。",
    x: 1.6,
    yaw: -0.16,
  },
  {
    id: "ai",
    s: 90,
    label: "AIに聞く",
    lines: [{ text: "AIに聞く", size: 330, outline: true }],
    caption:
      "記録をまとめて出力し、AIに「どう改善すべきか」を分析してもらいます。",
    x: -1.6,
    yaw: 0.16,
  },
  {
    id: "closing",
    s: 106,
    label: "はじめる",
    lines: [
      { text: "次のトレードの前に、", size: 150 },
      { text: "見返そう。", size: 300, green: true },
    ],
    x: 0,
    yaw: 0,
  },
];

/** カメラが進む距離（最後の文字の手前で止まる） */
export const TRAVEL_TOTAL = 98;
