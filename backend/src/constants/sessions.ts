/**
 * セッション区分（JSTの時。start 以上 end 未満。end が start より小さいときは日をまたぐ）。
 * 仮値（持ち主が確定したら直す）。夏時間は考慮しない。
 * 重なる時間帯は上から順に最初に当てはまったものにする。
 */
export interface SessionDef {
  key: "tokyo" | "london" | "ny" | "other";
  label: string;
  start: number;
  end: number;
}

export const SESSIONS: SessionDef[] = [
  { key: "tokyo", label: "東京", start: 9, end: 15 },
  { key: "london", label: "ロンドン", start: 16, end: 21 },
  { key: "ny", label: "NY", start: 21, end: 6 },
];

export const OTHER_SESSION: SessionDef = {
  key: "other",
  label: "その他",
  start: 0,
  end: 0,
};
