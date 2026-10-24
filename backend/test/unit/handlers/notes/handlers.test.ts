import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/note/noteService", () => ({
  noteService: {
    list: vi.fn(),
    get: vi.fn(),
    createSelf: vi.fn(),
    createAi: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    toRule: vi.fn(),
    validations: vi.fn(),
  },
}));

import * as notes from "../../../../src/handlers/notes";
import { noteService } from "../../../../src/services/note/noteService";
import { ConflictError, NotFoundError } from "../../../../src/lib/errors";

const ev = (o: Partial<APIGatewayProxyEvent> = {}) =>
  ({ ...o }) as APIGatewayProxyEvent;
const post = (b: unknown, params: Record<string, string> | null = null) =>
  ev({ body: JSON.stringify(b), pathParameters: params });

describe("notes handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /notes: 絞り込みとページングを渡す", async () => {
    vi.mocked(noteService.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
    });
    const res = await notes.listHandler(
      ev({
        queryStringParameters: {
          kind: "ai",
          validating: "true",
          page: "2",
          limit: "10",
        },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(noteService.list).toHaveBeenCalledWith("u", {
      kind: "ai",
      validatingOnly: true,
      page: 2,
      limit: 10,
    });
  });

  it.each([[{ page: "0" }], [{ limit: "abc" }], [{ kind: "x" }]])(
    "GET /notes: 不正なクエリは400 %j",
    async (q) => {
      const res = await notes.listHandler(ev({ queryStringParameters: q }));
      expect(res.statusCode).toBe(400);
      expect(noteService.list).not.toHaveBeenCalled();
    },
  );

  it("POST /notes/ai: 使ったAIと回答を渡して201", async () => {
    vi.mocked(noteService.createAi).mockResolvedValue({} as never);
    const res = await notes.createAiHandler(
      post({
        aiName: "Claude",
        dataRangeLabel: "直近30日",
        rawResponse: " 1. SLを入れる ",
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(noteService.createAi).toHaveBeenCalledWith("u", {
      aiName: "Claude",
      dataRangeLabel: "直近30日",
      rawResponse: "1. SLを入れる",
      title: null,
    });
  });

  it.each([
    [{ aiName: "Claude", rawResponse: "" }],
    [{ aiName: "Unknown", rawResponse: "a" }],
    [{ aiName: "Claude", rawResponse: "a".repeat(100_001) }],
  ])("POST /notes/ai: 不正な入力は400 %j", async (b) => {
    expect((await notes.createAiHandler(post(b))).statusCode).toBe(400);
    expect(noteService.createAi).not.toHaveBeenCalled();
  });

  it("POST /notes: 自分の気づきを既定値つきで作る", async () => {
    vi.mocked(noteService.createSelf).mockResolvedValue({} as never);
    const res = await notes.createHandler(post({ title: " 焦って入った " }));
    expect(res.statusCode).toBe(201);
    expect(noteService.createSelf).toHaveBeenCalledWith("u", {
      title: "焦って入った",
      body: "",
      emotionTags: [],
      nextRule: null,
      sourceTradeId: null,
    });
  });

  it("POST /notes: タイトルが空・トレードIDが不正なら400", async () => {
    expect((await notes.createHandler(post({ title: "" }))).statusCode).toBe(
      400,
    );
    expect(
      (
        await notes.createHandler(
          post({ title: "a", sourceTradeId: "not-uuid" }),
        )
      ).statusCode,
    ).toBe(400);
  });

  it("GET /notes/{id}: 見つからなければ404", async () => {
    vi.mocked(noteService.get).mockRejectedValue(new NotFoundError("学習メモ"));
    expect(
      (await notes.getHandler(ev({ pathParameters: { id: "x" } }))).statusCode,
    ).toBe(404);
  });

  it("POST .../to-rule: ルールを作って201。すでにルール化済みなら409", async () => {
    const params = { id: "n1", improvementId: "i1" };
    vi.mocked(noteService.toRule).mockResolvedValueOnce({ id: "r1" } as never);
    const ok = await notes.toRuleHandler(ev({ pathParameters: params }));
    expect(ok.statusCode).toBe(201);
    expect(noteService.toRule).toHaveBeenCalledWith("u", "n1", "i1");

    vi.mocked(noteService.toRule).mockRejectedValueOnce(
      new ConflictError("すでに"),
    );
    expect(
      (await notes.toRuleHandler(ev({ pathParameters: params }))).statusCode,
    ).toBe(409);
  });

  it("DELETE /notes/{id}", async () => {
    vi.mocked(noteService.delete).mockResolvedValue();
    const res = await notes.deleteHandler(ev({ pathParameters: { id: "n1" } }));
    expect(JSON.parse(res.body).data).toEqual({ id: "n1" });
  });
});
