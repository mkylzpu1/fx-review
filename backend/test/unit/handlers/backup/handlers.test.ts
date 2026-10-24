import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({ userId: "u", email: "e", name: "n" }),
}));
vi.mock("../../../../src/services/backup/backupService", async (orig) => ({
  ...(await orig<
    typeof import("../../../../src/services/backup/backupService")
  >()),
  backupService: { export: vi.fn(), restore: vi.fn(), deleteAll: vi.fn() },
}));

import * as h from "../../../../src/handlers/backup";
import { backupService } from "../../../../src/services/backup/backupService";

const ev = (body?: unknown) =>
  ({
    body: body === undefined ? null : JSON.stringify(body),
  }) as APIGatewayProxyEvent;

describe("backup handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /backup: バックアップを返す", async () => {
    vi.mocked(backupService.export).mockResolvedValue({
      app: "fx-review",
    } as never);
    const res = await h.exportHandler(ev());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.app).toBe("fx-review");
  });

  it("POST /backup/restore: 形式が違えば400で、復元は呼ばない", async () => {
    const res = await h.restoreHandler(ev({ app: "x", version: 1, data: {} }));
    expect(res.statusCode).toBe(400);
    expect(backupService.restore).not.toHaveBeenCalled();
  });

  it("POST /backup/restore: ボディが無ければ400", async () => {
    expect((await h.restoreHandler(ev())).statusCode).toBe(400);
  });

  it("POST /backup/restore: 正しいファイルなら復元する", async () => {
    vi.mocked(backupService.restore).mockResolvedValue({ trades: 2 });
    const res = await h.restoreHandler(
      ev({ app: "fx-review", version: 1, data: {} }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.trades).toBe(2);
    expect(vi.mocked(backupService.restore).mock.calls[0][0]).toBe("u");
  });

  it("DELETE /data: 全データを削除する", async () => {
    const res = await h.deleteDataHandler(ev());
    expect(res.statusCode).toBe(200);
    expect(backupService.deleteAll).toHaveBeenCalledWith("u");
  });
});
