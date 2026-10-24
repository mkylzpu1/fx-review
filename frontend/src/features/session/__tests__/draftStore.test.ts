import { describe, it, expect, beforeEach } from "vitest";
import {
  consumeLoginDraft,
  peekLoginDraft,
  peekReturnPath,
  registerDraft,
  resetDraftStore,
  saveDraftsForLogin,
} from "../draftStore";

describe("ログイン切れの入力退避", () => {
  beforeEach(() => {
    resetDraftStore();
    window.history.pushState({}, "", "/trades/new");
  });

  it("登録した入力を退避し、同じ画面で読み戻せる（何度読んでも同じ）", () => {
    registerDraft("trade-form:new", () => ({ entryPrice: "151.200" }));
    saveDraftsForLogin("/trades/new");
    expect(peekReturnPath()).toBe("/trades/new");
    expect(peekLoginDraft("trade-form:new")).toEqual({ entryPrice: "151.200" });
    expect(peekLoginDraft("trade-form:new")).toEqual({ entryPrice: "151.200" });
  });

  it("入力が無い（null）画面は退避しない", () => {
    registerDraft("trade-form:new", () => null);
    saveDraftsForLogin("/trades/new");
    expect(peekLoginDraft("trade-form:new")).toBeNull();
  });

  it("別の画面では戻さない", () => {
    registerDraft("trade-form:new", () => ({ a: 1 }));
    saveDraftsForLogin("/trades/new");
    window.history.pushState({}, "", "/rules");
    expect(peekLoginDraft("trade-form:new")).toBeNull();
  });

  it("戻し終えた入力は消える。最後の1件を消すと戻り先も消える", () => {
    registerDraft("trade-form:new", () => ({ a: 1 }));
    saveDraftsForLogin("/trades/new");
    consumeLoginDraft("trade-form:new");
    expect(peekLoginDraft("trade-form:new")).toBeNull();
    expect(peekReturnPath()).toBeNull();
  });

  it("解除した画面の入力は退避しない", () => {
    const off = registerDraft("trade-form:new", () => ({ a: 1 }));
    off();
    saveDraftsForLogin("/trades/new");
    expect(peekLoginDraft("trade-form:new")).toBeNull();
  });
});
