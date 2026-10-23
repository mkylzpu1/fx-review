import { sql } from "../lib/db";
import type { User } from "../types";

/**
 * ユーザーの永続化処理
 *
 * Store は DB アクセスのみを行う。ビジネスロジックは services/ に書く。
 */
export const userStore = {
  async get(userId: string): Promise<User | null> {
    const rows = await sql<User[]>`
      SELECT user_id as "userId", email, name, picture,
             created_at as "createdAt", updated_at as "updatedAt",
             last_login_at as "lastLoginAt"
      FROM users
      WHERE user_id = ${userId}
    `;
    return rows[0] ?? null;
  },

  async create(user: Omit<User, "lastLoginAt">): Promise<void> {
    await sql`
      INSERT INTO users (user_id, email, name, picture, created_at, updated_at)
      VALUES (${user.userId}, ${user.email}, ${user.name}, ${user.picture ?? null},
              ${user.createdAt}, ${user.updatedAt})
    `;
  },

  async updateProfile(
    userId: string,
    patch: { name: string; picture?: string; updatedAt: string },
  ): Promise<void> {
    await sql`
      UPDATE users
      SET name = ${patch.name}, picture = ${patch.picture ?? null}, updated_at = ${patch.updatedAt}
      WHERE user_id = ${userId}
    `;
  },

  async updateLastLogin(userId: string, lastLoginAt: string): Promise<void> {
    await sql`
      UPDATE users SET last_login_at = ${lastLoginAt} WHERE user_id = ${userId}
    `;
  },

  async delete(userId: string): Promise<void> {
    await sql`DELETE FROM users WHERE user_id = ${userId}`;
  },
};
