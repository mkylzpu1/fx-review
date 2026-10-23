import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "../../../../src/handlers/auth/me";
import type { APIGatewayProxyEvent } from "aws-lambda";

// lib/cognito をモック
vi.mock("../../../../src/lib/cognito", () => ({
  verifyAuth: vi.fn().mockResolvedValue({
    userId: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    picture: undefined,
  }),
}));

// stores/userStore をモック
vi.mock("../../../../src/stores/userStore", () => ({
  userStore: {
    get: vi.fn(),
    create: vi.fn(),
    updateProfile: vi.fn(),
    updateLastLogin: vi.fn(),
  },
}));

import { userStore } from "../../../../src/stores/userStore";

const mockEvent = {} as APIGatewayProxyEvent;

describe("GET /auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("既存ユーザーの情報を返す", async () => {
    vi.mocked(userStore.get).mockResolvedValue({
      userId: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      picture: undefined,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const res = await handler(mockEvent);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe("test-user-id");
    expect(userStore.create).not.toHaveBeenCalled();
  });

  it("新規ユーザーを作成して情報を返す", async () => {
    vi.mocked(userStore.get).mockResolvedValue(null);
    vi.mocked(userStore.create).mockResolvedValue(undefined);

    const res = await handler(mockEvent);

    expect(res.statusCode).toBe(200);
    expect(userStore.create).toHaveBeenCalledOnce();
    const body = JSON.parse(res.body);
    expect(body.data.userId).toBe("test-user-id");
  });
});
