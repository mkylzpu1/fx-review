import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/settings/settingsService", () => ({
  settingsService: { get: vi.fn(), save: vi.fn() },
}));
vi.mock("../../../../src/services/settings/pairService", () => ({
  pairService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../../../../src/services/settings/tagService", () => ({
  tagService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getHandler, putHandler } from "../../../../src/handlers/settings";
import * as pairs from "../../../../src/handlers/currencyPairs";
import * as tags from "../../../../src/handlers/tags";
import { settingsService } from "../../../../src/services/settings/settingsService";
import { tagService } from "../../../../src/services/settings/tagService";
import { pairService } from "../../../../src/services/settings/pairService";
import { NotFoundError, ConflictError } from "../../../../src/lib/errors";

const ev = (o: Partial<APIGatewayProxyEvent> = {}) =>
  ({ ...o }) as APIGatewayProxyEvent;
const body = (o: unknown) => ev({ body: JSON.stringify(o) });

describe("settings handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /settings: 未作成は404", async () => {
    vi.mocked(settingsService.get).mockRejectedValue(new NotFoundError("設定"));
    expect((await getHandler(ev())).statusCode).toBe(404);
  });

  it("PUT /settings: 正常系", async () => {
    vi.mocked(settingsService.save).mockResolvedValue({} as never);
    const res = await putHandler(body({ balanceJpy: 750000, maxRiskPct: 1 }));
    expect(res.statusCode).toBe(200);
    expect(settingsService.save).toHaveBeenCalledWith("u", {
      balanceJpy: 750000,
      maxRiskPct: 1,
    });
  });

  it.each([
    [{ balanceJpy: 0 }],
    [{ balanceJpy: 1.5 }],
    [{ maxRiskPct: 0 }],
    [{ chartDefaultTf: "2h" }],
    [
      {
        emaSettings: [
          { period: 9, visible: true },
          { period: 9, visible: false },
        ],
      },
    ],
  ])("PUT /settings: 不正な入力 %j は400", async (input) => {
    expect((await putHandler(body(input))).statusCode).toBe(400);
    expect(settingsService.save).not.toHaveBeenCalled();
  });
});

describe("currency-pairs handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST: 重複は409", async () => {
    vi.mocked(pairService.create).mockRejectedValue(new ConflictError("重複"));
    const res = await pairs.createHandler(
      body({
        symbol: "USDJPY",
        pipSize: 0.01,
        pipValueJpyPerLot: 1000,
        showInPicker: true,
      }),
    );
    expect(res.statusCode).toBe(409);
  });

  it("POST: symbol形式が不正なら400", async () => {
    const res = await pairs.createHandler(
      body({
        symbol: "usd/jpy",
        pipSize: 0.01,
        pipValueJpyPerLot: 1000,
        showInPicker: true,
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("DELETE: id無しは400", async () => {
    expect((await pairs.deleteHandler(ev())).statusCode).toBe(400);
  });
});

describe("tags handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET: kind を渡す", async () => {
    vi.mocked(tagService.list).mockResolvedValue([]);
    await tags.listHandler(ev({ queryStringParameters: { kind: "emotion" } }));
    expect(tagService.list).toHaveBeenCalledWith("u", "emotion");
  });

  it("GET: 不正な kind は400", async () => {
    const res = await tags.listHandler(
      ev({ queryStringParameters: { kind: "x" } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("POST: 空のタグ名は400、正常は201", async () => {
    expect(
      (await tags.createHandler(body({ kind: "emotion", name: "  " })))
        .statusCode,
    ).toBe(400);
    vi.mocked(tagService.create).mockResolvedValue({} as never);
    expect(
      (await tags.createHandler(body({ kind: "emotion", name: "冷静" })))
        .statusCode,
    ).toBe(201);
  });

  it("DELETE: 存在しなければ404", async () => {
    vi.mocked(tagService.delete).mockRejectedValue(new NotFoundError("タグ"));
    const res = await tags.deleteHandler(ev({ pathParameters: { id: "x" } }));
    expect(res.statusCode).toBe(404);
  });
});
