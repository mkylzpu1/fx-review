import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/rule/ruleService", () => ({
  ruleService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import * as rules from "../../../../src/handlers/rules";
import { ruleService } from "../../../../src/services/rule/ruleService";
import { NotFoundError } from "../../../../src/lib/errors";

const ev = (o: Partial<APIGatewayProxyEvent> = {}) =>
  ({ ...o }) as APIGatewayProxyEvent;
const body = (o: unknown, id?: string) =>
  ev({
    body: JSON.stringify(o),
    pathParameters: id ? { id } : null,
  });

describe("rules handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /rules: 一覧を返す", async () => {
    vi.mocked(ruleService.list).mockResolvedValue([]);
    const res = await rules.listHandler(ev());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.items).toEqual([]);
  });

  it("POST /rules: 既定値を補って作成する", async () => {
    vi.mocked(ruleService.create).mockResolvedValue({} as never);
    const res = await rules.createHandler(body({ title: " SLを入れる " }));
    expect(res.statusCode).toBe(201);
    expect(ruleService.create).toHaveBeenCalledWith("u", {
      title: "SLを入れる",
      description: "",
      autoKey: null,
      isActive: true,
    });
  });

  it.each([
    [{ title: "" }],
    [{ title: "a".repeat(101) }],
    [{ title: "x", autoKey: "unknown" }],
  ])("POST /rules: 不正な入力は400 %j", async (b) => {
    expect((await rules.createHandler(body(b))).statusCode).toBe(400);
    expect(ruleService.create).not.toHaveBeenCalled();
  });

  it("PUT /rules/{id}: 無効化できる", async () => {
    vi.mocked(ruleService.update).mockResolvedValue({} as never);
    const res = await rules.updateHandler(body({ isActive: false }, "r1"));
    expect(res.statusCode).toBe(200);
    expect(ruleService.update).toHaveBeenCalledWith("u", "r1", {
      isActive: false,
    });
  });

  it("PUT /rules/{id}: 存在しなければ404", async () => {
    vi.mocked(ruleService.update).mockRejectedValue(
      new NotFoundError("ルール"),
    );
    expect(
      (await rules.updateHandler(body({ title: "x" }, "nope"))).statusCode,
    ).toBe(404);
  });

  it("DELETE /rules/{id}: idが無ければ400", async () => {
    expect((await rules.deleteHandler(ev())).statusCode).toBe(400);
  });

  it("DELETE /rules/{id}: 正常系", async () => {
    vi.mocked(ruleService.delete).mockResolvedValue();
    const res = await rules.deleteHandler(ev({ pathParameters: { id: "r1" } }));
    expect(res.statusCode).toBe(200);
  });
});
