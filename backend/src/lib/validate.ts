import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Zodスキーマでバリデーションし、失敗時は ValidationError を投げる。
 *
 * 使用例:
 *   const body = parseBody(event.body, z.object({ name: z.string() }));
 */
export function parseBody<T>(raw: string | null, schema: z.ZodType<T>): T {
  if (!raw) throw new ValidationError("リクエストボディがありません");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("JSONの形式が不正です");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message).join(", ");
    throw new ValidationError(messages);
  }

  return result.data;
}

/**
 * クエリパラメーターをバリデーションする。
 */
export function parseQuery<T>(
  params: Record<string, string | undefined> | null,
  schema: z.ZodType<T>,
): T {
  const result = schema.safeParse(params ?? {});
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message).join(", ");
    throw new ValidationError(messages);
  }
  return result.data;
}
