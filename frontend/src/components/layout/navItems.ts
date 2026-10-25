import { ROUTES } from "@/constants/routes";

export interface NavItem {
  to: string;
  label: string;
  /** この接頭辞で始まるパスのとき「現在地」にする */
  matchPrefixes: string[];
}

/** 上部ナビ（統一ナビ）。取り込み・編集・キュー・詳細は「トレード」、週次レビューは「統計」、ルール詳細は「ルール」 */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.STATS, label: "統計", matchPrefixes: ["/stats"] },
  { to: ROUTES.TRADES, label: "トレード", matchPrefixes: ["/trades"] },
  { to: ROUTES.RULES, label: "ルール", matchPrefixes: ["/rules"] },
  { to: ROUTES.NOTES, label: "学習メモ", matchPrefixes: ["/notes"] },
  { to: ROUTES.EXPORT, label: "エクスポート", matchPrefixes: ["/export"] },
  { to: ROUTES.GUIDE, label: "ガイド", matchPrefixes: ["/guide"] },
  { to: ROUTES.SETTINGS, label: "設定", matchPrefixes: ["/settings"] },
];

/** スマホ下タブ。「その他」にエクスポート・設定・アカウントを入れる */
export const MOBILE_TABS: NavItem[] = [
  { to: ROUTES.STATS, label: "統計", matchPrefixes: ["/stats"] },
  { to: ROUTES.TRADES, label: "トレード", matchPrefixes: ["/trades"] },
  { to: ROUTES.RULES, label: "ルール", matchPrefixes: ["/rules"] },
  { to: ROUTES.NOTES, label: "メモ", matchPrefixes: ["/notes"] },
];

export const MOBILE_MORE_ITEMS: NavItem[] = [
  { to: ROUTES.EXPORT, label: "エクスポート", matchPrefixes: ["/export"] },
  { to: ROUTES.GUIDE, label: "ご利用ガイド", matchPrefixes: ["/guide"] },
  { to: ROUTES.SETTINGS, label: "設定", matchPrefixes: ["/settings"] },
  { to: ROUTES.ACCOUNT, label: "アカウント", matchPrefixes: ["/account"] },
];

export function isCurrent(item: NavItem, pathname: string): boolean {
  return item.matchPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
