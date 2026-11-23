import type { Tag } from "@/features/settings/types";

/**
 * 根拠タグが多くなってきたため、タグ名のキーワードから大まかなグループに
 * 振り分けて表示するためのユーティリティ。
 * マッチしないタグ（ユーザーが独自に追加したものなど）は「その他」に入る。
 */
const RATIONALE_GROUPS: { title: string; match: RegExp }[] = [
  {
    title: "順張り・ブレイク",
    match:
      /押し目|戻り売|上位足順張り|複数時間足|ブレイク|高値・安値更新|逆張り/,
  },
  {
    title: "レンジ・もみ合い",
    match:
      /レンジ|保ち合い|トライアングル|ウェッジ|フラッグ|ペナント|チャネルライン|もみ合い放れ/,
  },
  {
    title: "反転パターン",
    match:
      /ダブルボトム|三尊|カップウィズハンドル|ソーサー|V字|逆V字|N波動/,
  },
  {
    title: "ライン・サポレジ",
    match: /トレンドライン|水平線|サポレジ|窓埋め/,
  },
  {
    title: "インジケーター",
    match:
      /EMA|ゴールデンクロス|デッドクロス|ボリンジャーバンド|ダイバージェンス|一目均衡表|RSI|MACD/,
  },
  {
    title: "ローソク足",
    match: /ピンバー|包み足|はらみ足|十字線|たくり線|三空|三兵|ソルジャーズ|クロウズ/,
  },
  {
    title: "タイミング・環境",
    match: /指標前後|要人発言|中銀会合|FOMC|日銀|セッション開始|東京仲値/,
  },
];

export interface TagGroup {
  title: string;
  tags: Tag[];
}

/** 根拠タグ(kind=rationale)をキーワードでグルーピングする。感情タグ等はそのまま1グループで返す */
export function groupRationaleTags(tags: Tag[]): TagGroup[] {
  const groups: TagGroup[] = RATIONALE_GROUPS.map((g) => ({
    title: g.title,
    tags: [],
  }));
  const other: Tag[] = [];

  for (const tag of tags) {
    const hit = RATIONALE_GROUPS.findIndex((g) => g.match.test(tag.name));
    if (hit === -1) {
      other.push(tag);
    } else {
      groups[hit].tags.push(tag);
    }
  }

  if (other.length > 0) groups.push({ title: "その他", tags: other });
  return groups.filter((g) => g.tags.length > 0);
}
