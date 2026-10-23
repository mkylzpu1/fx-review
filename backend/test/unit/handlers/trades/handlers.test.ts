import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/trade/tradeService", () => ({
  tradeService: {
    list: vi.fn(),
    queue: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

import * as trades from "../../../../src/handlers/trades";
import { tradeService } from "../../../../src/services/trade/tradeService";
import { NotFoundError, ValidationError } from "../../../../src/lib/errors";

const ev = (o: Partial<APIGatewayProxyEvent> = {}) =>
  ({ ...o }) as APIGatewayProxyEvent;
const body = (o: unknown, id?: string) =>
  ev({ body: JSON.stringify(o), pathParameters: id ? { id } : null });

const minimal = {
  pair: "USDJPY",
  side: "buy",
  lots: 0.1,
  entryAt: "2026-10-01T22:10:00+09:00",
  entryPrice: 150.123,
};

describe("POST /trades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("必須項目だけで保存できる（SL・TP・根拠は任意）→ 未指定は null / 空配列", async () => {
    vi.mocked(tradeService.create).mockResolvedValue({} as never);
    const res = await trades.createHandler(body(minimal));
    expect(res.statusCode).toBe(201);
    expect(tradeService.create).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({
        slPrice: null,
        tpPrice: null,
        slReason: null,
        confidence: null,
        exitAt: null,
        exitMethod: "open",
        draft: false,
        tagIds: [],
        ruleChecks: [],
      }),
    );
  });

  it("空文字のメモは null にそろえる", async () => {
    vi.mocked(tradeService.create).mockResolvedValue({} as never);
    await trades.createHandler(body({ ...minimal, rationaleMemo: "  " }));
    expect(tradeService.create).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({ rationaleMemo: null }),
    );
  });

  it.each([
    ["ロット0", { lots: 0 }],
    ["ロットが小数3桁", { lots: 0.123 }],
    ["方向が不正", { side: "long" }],
    ["日時が不正", { entryAt: "2026/10/01 22:10" }],
    ["エントリー価格が負", { entryPrice: -1 }],
    ["確信度が範囲外", { confidence: 6 }],
    ["タグIDがUUIDでない", { tagIds: ["x"] }],
  ])("不正な入力は400: %s", async (_n, patch) => {
    const res = await trades.createHandler(body({ ...minimal, ...patch }));
    expect(res.statusCode).toBe(400);
    expect(tradeService.create).not.toHaveBeenCalled();
  });

  it("サービスの検証エラー（SLの向きなど）は400で理由を返す", async () => {
    vi.mocked(tradeService.create).mockRejectedValue(
      new ValidationError("買いのSLはエントリーより低く設定してください"),
    );
    const res = await trades.createHandler(body({ ...minimal, slPrice: 151 }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.message).toContain("買いのSL");
  });

  it("本文なしは400", async () => {
    expect((await trades.createHandler(ev())).statusCode).toBe(400);
  });
});

describe("GET /trades", () => {
  beforeEach(() => vi.clearAllMocks());

  it("既定値（新しい順・1ページ20件）で呼ぶ", async () => {
    vi.mocked(tradeService.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    const res = await trades.listHandler(ev());
    expect(res.statusCode).toBe(200);
    expect(tradeService.list).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({
        sort: "entry_desc",
        page: 1,
        limit: 20,
        deviationOnly: false,
        pending: false,
      }),
    );
  });

  it("絞り込みとページングを渡す", async () => {
    vi.mocked(tradeService.list).mockResolvedValue({} as never);
    await trades.listHandler(
      ev({
        queryStringParameters: {
          result: "loss",
          deviationOnly: "true",
          q: "押し目",
          page: "3",
          limit: "50",
          sort: "pnl_asc",
        },
      }),
    );
    expect(tradeService.list).toHaveBeenCalledWith(
      "u",
      expect.objectContaining({
        result: "loss",
        deviationOnly: true,
        q: "押し目",
        page: 3,
        limit: 50,
        sort: "pnl_asc",
      }),
    );
  });

  it.each([
    { limit: "0" },
    { limit: "101" },
    { page: "0" },
    { page: "a" },
    { result: "draw" },
  ])("不正なクエリは400 %j", async (q) => {
    const res = await trades.listHandler(ev({ queryStringParameters: q }));
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /trades/queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("既定は filter=all", async () => {
    vi.mocked(tradeService.queue).mockResolvedValue({} as never);
    await trades.queueHandler(ev());
    expect(tradeService.queue).toHaveBeenCalledWith("u", {
      filter: "all",
      sort: "entry_desc",
      page: 1,
      limit: 20,
    });
  });
  it("未知のfilterは400", async () => {
    const res = await trades.queueHandler(
      ev({ queryStringParameters: { filter: "later" } }),
    );
    expect(res.statusCode).toBe(400);
  });
});

describe("GET/PUT/DELETE /trades/{id}", () => {
  beforeEach(() => vi.clearAllMocks());

  it("存在しなければ404", async () => {
    vi.mocked(tradeService.get).mockRejectedValue(
      new NotFoundError("トレード"),
    );
    const res = await trades.getHandler(ev({ pathParameters: { id: "x" } }));
    expect(res.statusCode).toBe(404);
  });
  it("PUT: 決済入力を渡せる", async () => {
    vi.mocked(tradeService.update).mockResolvedValue({} as never);
    const res = await trades.updateHandler(
      body(
        {
          ...minimal,
          exitAt: "2026-10-01T22:40:00+09:00",
          exitPrice: 150.4,
          exitMethod: "tp",
        },
        "t1",
      ),
    );
    expect(res.statusCode).toBe(200);
    expect(tradeService.update).toHaveBeenCalledWith(
      "u",
      "t1",
      expect.objectContaining({ exitPrice: 150.4, exitMethod: "tp" }),
    );
  });
  it("DELETE と restore: idが無ければ400、あれば呼ぶ", async () => {
    expect((await trades.deleteHandler(ev())).statusCode).toBe(400);
    expect((await trades.restoreHandler(ev())).statusCode).toBe(400);
    vi.mocked(tradeService.delete).mockResolvedValue();
    vi.mocked(tradeService.restore).mockResolvedValue({} as never);
    const e = ev({ pathParameters: { id: "t1" } });
    expect((await trades.deleteHandler(e)).statusCode).toBe(200);
    expect((await trades.restoreHandler(e)).statusCode).toBe(200);
  });
});
