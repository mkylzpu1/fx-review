import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/stores/noteStore", () => ({
  noteStore: {
    create: vi.fn(),
    findById: vi.fn(),
    improvements: vi.fn(),
    findImprovement: vi.fn(),
    convertToRule: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  },
}));
vi.mock("../../../src/stores/ruleStore", () => ({
  ruleStore: {
    maxSortOrder: vi.fn().mockResolvedValue(4),
    list: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("../../../src/stores/tradeStore", () => ({
  tradeStore: { findById: vi.fn() },
}));
vi.mock("../../../src/services/trade/tradeService", () => ({
  tradeService: { listAll: vi.fn().mockResolvedValue([]) },
}));

import { noteService, summaryOf } from "../../../src/services/note/noteService";
import { noteStore } from "../../../src/stores/noteStore";
import { tradeStore } from "../../../src/stores/tradeStore";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../src/lib/errors";

const note = { id: "n1", kind: "ai", rawResponse: null } as never;

describe("noteService.createAi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(noteStore.create).mockResolvedValue("n1");
    vi.mocked(noteStore.findById).mockResolvedValue(note);
    vi.mocked(noteStore.improvements).mockResolvedValue([]);
  });

  it("改善案をパースして保存し、タイトルは「AI名の分析 日付(JST)」にする", async () => {
    await noteService.createAi(
      "u",
      {
        aiName: "Claude",
        dataRangeLabel: "直近30日",
        rawResponse: "## 改善案\n- SLを必ず入れる（n=8）",
        title: null,
      },
      new Date("2026-10-24T20:00:00Z"), // JSTでは10/25
    );
    const [, write, improvements] = vi.mocked(noteStore.create).mock.calls[0];
    expect(write).toMatchObject({
      kind: "ai",
      title: "Claudeの分析 2026-10-25",
      aiName: "Claude",
    });
    expect(improvements).toEqual([
      { text: "SLを必ず入れる（n=8）", sampleN: 8 },
    ]);
  });

  it("構造のない回答は、改善案なしで原文だけ保存する", async () => {
    await noteService.createAi("u", {
      aiName: "ChatGPT",
      dataRangeLabel: null,
      rawResponse: "全体として良い傾向です。",
      title: null,
    });
    const [, write, improvements] = vi.mocked(noteStore.create).mock.calls[0];
    expect(write).toMatchObject({
      rawResponse: "全体として良い傾向です。",
      body: "全体として良い傾向です。",
    });
    expect(improvements).toEqual([]);
  });
});

describe("noteService.createSelf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("他人のトレードIDは「見つからない」として弾く", async () => {
    vi.mocked(tradeStore.findById).mockResolvedValue(null);
    await expect(
      noteService.createSelf("u", {
        title: "t",
        body: "",
        emotionTags: [],
        nextRule: null,
        sourceTradeId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(noteStore.create).not.toHaveBeenCalled();
  });
});

describe("noteService.toRule", () => {
  beforeEach(() => vi.clearAllMocks());
  const imp = { id: "i1", noteId: "n1", text: "あ".repeat(150) } as never;

  it("改善案が自分のものでなければ404", async () => {
    vi.mocked(noteStore.findImprovement).mockResolvedValue(null);
    await expect(noteService.toRule("u", "n1", "i1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("ルール名は100文字、説明は全文（500文字まで）で、並び順は末尾に作る", async () => {
    vi.mocked(noteStore.findImprovement).mockResolvedValue(imp);
    vi.mocked(noteStore.convertToRule).mockResolvedValue({ id: "r1" } as never);
    await noteService.toRule("u", "n1", "i1");
    expect(noteStore.convertToRule).toHaveBeenCalledWith("u", "i1", {
      title: "あ".repeat(100),
      description: "あ".repeat(150),
      sortOrder: 5,
    });
  });

  it("すでにルール化済み（二重クリック）なら409で、ルールは増やさない", async () => {
    vi.mocked(noteStore.findImprovement).mockResolvedValue(imp);
    vi.mocked(noteStore.convertToRule).mockResolvedValue(null);
    await expect(noteService.toRule("u", "n1", "i1")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("summaryOf", () => {
  it("見出し・箇条書きを除いた最初の文章を、200文字までにする", () => {
    const sections = [
      { heading: "", lines: ["- 箇条書き", "総評です。" + "あ".repeat(300)] },
    ];
    const s = summaryOf("raw", sections);
    expect(s.startsWith("総評です。")).toBe(true);
    expect(s).toHaveLength(200);
  });
  it("文章が無ければ原文の先頭を使う", () => {
    expect(
      summaryOf("  - a\n  - b  ", [{ heading: "", lines: ["- a", "- b"] }]),
    ).toBe("- a - b");
  });
});
