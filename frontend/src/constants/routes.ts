/**
 * アプリケーションのルート定義
 */
export const ROUTES = {
  LP: "/lp",
  LOGIN: "/login",
  CALLBACK: "/callback",
  ONBOARDING: "/onboarding",
  STATS: "/stats",
  STATS_WEEKLY: "/stats/weekly",
  TRADES: "/trades",
  TRADE_NEW: "/trades/new",
  TRADE_QUEUE: "/trades/queue",
  TRADE_IMPORT: "/trades/import",
  TRADE_DETAIL: "/trades/:id",
  TRADE_EDIT: "/trades/:id/edit",
  RULES: "/rules",
  RULE_DETAIL: "/rules/:id",
  NOTES: "/notes",
  NOTE_DETAIL: "/notes/:id",
  EXPORT: "/export",
  GUIDE: "/guide",
  SETTINGS: "/settings",
  ACCOUNT: "/account",
} as const;

/** ログイン後の既定遷移先 */
export const DEFAULT_AUTHENTICATED_ROUTE = ROUTES.STATS;
