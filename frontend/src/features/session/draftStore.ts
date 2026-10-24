/**
 * ログイン切れのとき、入力途中の内容をログイン後に戻すための退避。
 * 画面側は registerDraft で「いまの入力」を返す関数を登録しておき、
 * ダイアログの「ログインする」で sessionStorage に書き出す。
 */
const STORAGE_KEY = "fx-review:login-restore";

interface Saved {
  path: string;
  drafts: Record<string, unknown>;
}

const getters = new Map<string, () => unknown>();

/** 入力途中の内容を返す関数を登録する（入力が無いときは null を返す）。解除関数を返す */
export function registerDraft(key: string, get: () => unknown): () => void {
  getters.set(key, get);
  return () => {
    if (getters.get(key) === get) getters.delete(key);
  };
}

/** 登録されている入力を退避する。戻り先のパスも一緒に残す */
export function saveDraftsForLogin(path: string): void {
  const drafts: Record<string, unknown> = {};
  getters.forEach((get, key) => {
    const value = get();
    if (value !== null && value !== undefined) drafts[key] = value;
  });
  const saved: Saved = { path, drafts };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // 保存できなくてもログイン自体は続ける
  }
}

function read(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** 退避した入力を読む（読むだけ。何度呼んでも同じ。消すのは consumeLoginDraft） */
export function peekLoginDraft<T>(key: string): T | null {
  const saved = read();
  if (
    !saved ||
    saved.path !== window.location.pathname + window.location.search
  )
    return null;
  return (saved.drafts[key] as T | undefined) ?? null;
}

/** 戻し終えた入力を消す */
export function consumeLoginDraft(key: string): void {
  const saved = read();
  if (!saved) return;
  delete saved.drafts[key];
  try {
    if (Object.keys(saved.drafts).length === 0)
      sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // 無視
  }
}

/** ログイン後の戻り先。退避があればそのパス（読むだけ。入力は画面側で戻す） */
export function peekReturnPath(): string | null {
  return read()?.path ?? null;
}

/** テスト用 */
export function resetDraftStore(): void {
  getters.clear();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無視
  }
}
