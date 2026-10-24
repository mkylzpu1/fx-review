/**
 * 楽天FX証券の約定履歴CSV（execution-7.csv）と同じ形式の合成データ。
 * 実口座のデータは含まない。形式（全項目クォート・新しい行が上・秒なしJST・数量は通貨単位）と、
 * 「同時に2ポジションを持つため新規と決済の約定Noが隣り合わない」ケースを再現する。
 */
export const HEADER = [
  "約定No.",
  "通貨ペア",
  "注文区分",
  "売買",
  "約定数量",
  "約定レート",
  "取引損益",
  "取引損益（円換算）",
  "注文日時",
  "約定日時",
];

export interface Fill {
  no: number;
  kind: "新規" | "決済";
  side: "買" | "売";
  qty: number;
  rate: number;
  pnl: number | null;
  at: string;
  pair?: string;
}

export const csvOf = (fills: Fill[], header = HEADER): string => {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.map(q).join(",")];
  // 新しい行が上
  for (const f of [...fills].sort((a, b) => b.no - a.no)) {
    lines.push(
      [
        f.no,
        f.pair ?? "ドル/円",
        f.kind,
        f.side,
        f.qty,
        f.rate.toFixed(3),
        f.pnl === null ? "-" : f.pnl,
        f.pnl === null ? "-" : f.pnl,
        f.at,
        f.at,
      ]
        .map(q)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
};

const pad = (n: number) => String(n).padStart(2, "0");
/** 2026/10/01 22:10 から i 分ずつ進める（JST） */
export const jstAt = (i: number) => {
  const d = new Date(Date.UTC(2026, 9, 1, 22, 10 + i));
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const pnlOf = (side: "買" | "売", entry: number, exit: number, qty: number) =>
  Math.round((side === "買" ? exit - entry : entry - exit) * qty);

export interface Sample {
  fills: Fill[];
  /** 期待するトレード数と、約定No.の組（新規, 決済） */
  expectedPairs: [number, number][];
}

/** 211トレード。うち13グループは2ポジションを同時に持つ（新規2回→決済2回） */
export function buildSample(): Sample {
  const fills: Fill[] = [];
  const expectedPairs: [number, number][] = [];
  let no = 1000;
  let t = 0;
  let made = 0;
  let group = 0;
  while (made < 211) {
    const side: "買" | "売" = made % 3 === 0 ? "売" : "買";
    const close: "買" | "売" = side === "買" ? "売" : "買";
    const qty = made % 7 === 0 ? 5000 : 10000;
    const base = 150 + (made % 50) * 0.01;
    const overlap = group < 13 && made % 16 === 15;
    if (overlap) {
      group++;
      const a = { no: no++, rate: base };
      fills.push({
        no: a.no,
        kind: "新規",
        side,
        qty,
        rate: a.rate,
        pnl: null,
        at: jstAt(t++),
      });
      const b = { no: no++, rate: base + 0.03 };
      fills.push({
        no: b.no,
        kind: "新規",
        side,
        qty,
        rate: b.rate,
        pnl: null,
        at: jstAt(t++),
      });
      const ea = { no: no++, rate: a.rate + 0.05 };
      fills.push({
        no: ea.no,
        kind: "決済",
        side: close,
        qty,
        rate: ea.rate,
        pnl: pnlOf(side, a.rate, ea.rate, qty),
        at: jstAt(t++),
      });
      const eb = { no: no++, rate: b.rate - 0.02 };
      fills.push({
        no: eb.no,
        kind: "決済",
        side: close,
        qty,
        rate: eb.rate,
        pnl: pnlOf(side, b.rate, eb.rate, qty),
        at: jstAt(t++),
      });
      expectedPairs.push([a.no, ea.no], [b.no, eb.no]);
      made += 2;
    } else {
      const en = no++;
      const ex = no++;
      const exitRate = base + (made % 2 === 0 ? 0.06 : -0.04);
      fills.push({
        no: en,
        kind: "新規",
        side,
        qty,
        rate: base,
        pnl: null,
        at: jstAt(t++),
      });
      fills.push({
        no: ex,
        kind: "決済",
        side: close,
        qty,
        rate: exitRate,
        pnl: pnlOf(side, base, exitRate, qty),
        at: jstAt(t++),
      });
      expectedPairs.push([en, ex]);
      made += 1;
    }
  }
  return { fills, expectedPairs };
}
