import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/import/importService", () => ({
  MAX_FILES: 20,
  importService: { preview: vi.fn(), commit: vi.fn() },
}));

import * as imports from "../../../../src/handlers/imports";
import { importService } from "../../../../src/services/import/importService";
import { UnauthorizedError, ValidationError } from "../../../../src/lib/errors";
import { verifyAuth } from "../../../../src/lib/cognito";

const body = (o: unknown) =>
  ({ body: JSON.stringify(o) }) as unknown as APIGatewayProxyEvent;
const files = [{ name: "a.csv", text: '"約定No."\r\n' }];
const parse = (r: { body: string }) => JSON.parse(r.body);

describe("POST /imports/preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("認証ユーザーのIDでプレビューする", async () => {
    vi.mocked(importService.preview).mockResolvedValue({ ok: 1 } as never);
    const res = await imports.previewHandler(body({ files }));
    expect(res.statusCode).toBe(200);
    expect(parse(res)).toEqual({ success: true, data: { ok: 1 } });
    expect(importService.preview).toHaveBeenCalledWith("u", files);
  });

  it("ファイルが無いと400", async () => {
    const res = await imports.previewHandler(body({ files: [] }));
    expect(res.statusCode).toBe(400);
    expect(importService.preview).not.toHaveBeenCalled();
  });

  it("ボディが無いと400", async () => {
    const res = await imports.previewHandler({
      body: null,
    } as unknown as APIGatewayProxyEvent);
    expect(res.statusCode).toBe(400);
  });

  it("未認証は401（サービスは呼ばない）", async () => {
    vi.mocked(verifyAuth).mockRejectedValueOnce(new UnauthorizedError());
    const res = await imports.previewHandler(body({ files }));
    expect(res.statusCode).toBe(401);
    expect(importService.preview).not.toHaveBeenCalled();
  });

  it("サービスの検証エラーは400で返す", async () => {
    vi.mocked(importService.preview).mockRejectedValue(
      new ValidationError("合計サイズが大きすぎます"),
    );
    const res = await imports.previewHandler(body({ files }));
    expect(res.statusCode).toBe(400);
    expect(parse(res).error.message).toContain("大きすぎ");
  });
});

describe("POST /imports/commit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("duplicateMode を渡して確定する", async () => {
    vi.mocked(importService.commit).mockResolvedValue({ imported: 2 } as never);
    const res = await imports.commitHandler(
      body({ files, duplicateMode: "overwrite" }),
    );
    expect(res.statusCode).toBe(200);
    expect(importService.commit).toHaveBeenCalledWith("u", files, "overwrite");
  });

  it("duplicateMode が無い・不正だと400（取り違え防止）", async () => {
    for (const b of [{ files }, { files, duplicateMode: "merge" }]) {
      const res = await imports.commitHandler(body(b));
      expect(res.statusCode).toBe(400);
    }
    expect(importService.commit).not.toHaveBeenCalled();
  });
});
