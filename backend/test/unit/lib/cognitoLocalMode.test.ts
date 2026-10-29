import { describe, expect, it } from "vitest";
import { assertLocalModeAllowed } from "../../../src/lib/cognito";
import { UnauthorizedError } from "../../../src/lib/errors";

describe("assertLocalModeAllowed", () => {
  it("手元のHostなら通す（ポート付き・IPv6も）", () => {
    for (const h of [
      "localhost:3000",
      "127.0.0.1:3000",
      "[::1]:3000",
      "LOCALHOST",
    ])
      expect(() => assertLocalModeAllowed({}, h)).not.toThrow();
  });

  it("Hostが無ければ通す（テストなどでの直接呼び出し）", () => {
    expect(() => assertLocalModeAllowed({}, undefined)).not.toThrow();
  });

  it("手元以外のHost（DNSリバインディング）は拒否する", () => {
    for (const h of [
      "evil.example:3000",
      "192.168.0.5:3000",
      "localhost.evil.com",
    ])
      expect(() => assertLocalModeAllowed({}, h)).toThrow(UnauthorizedError);
  });

  it("本物のLambda上では IS_LOCAL でも拒否する", () => {
    expect(() =>
      assertLocalModeAllowed(
        { AWS_LAMBDA_FUNCTION_NAME: "fn" },
        "localhost:3000",
      ),
    ).toThrow(UnauthorizedError);
  });

  it("sam local（AWS_SAM_LOCAL=true）では通す", () => {
    expect(() =>
      assertLocalModeAllowed(
        { AWS_LAMBDA_FUNCTION_NAME: "fn", AWS_SAM_LOCAL: "true" },
        "localhost:3000",
      ),
    ).not.toThrow();
  });
});
