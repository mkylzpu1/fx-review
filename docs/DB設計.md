# DB設計

## 基本ルール

- テーブル名・カラム名は `snake_case`
- 主キーは `TEXT` 型（Cognitoの `sub` を使う場合）またはUUID
- タイムスタンプは `TIMESTAMPTZ`（タイムゾーン付き）
- `NOT NULL` を基本とし、NULLを許容するカラムは意図的に設計する
- 外部キー制約を必ず設定する

## マイグレーション管理

`backend/db/migrations/` に連番ファイルで追加する。

```
001_create_users.sql
002_create_items.sql
003_add_index_to_items.sql
```

一度マージしたマイグレーションファイルは編集しない（新しいファイルで変更を加える）。

## テーブルテンプレート

```sql
CREATE TABLE IF NOT EXISTS <table_name> (
  -- 主キー（Cognito sub を使う場合は TEXT、それ以外はUUID）
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ユーザー外部キー（ユーザーに紐づくデータは必須）
  user_id       TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- アプリ固有カラム
  title         TEXT        NOT NULL,
  description   TEXT,

  -- 共通タイムスタンプ
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス（user_id での絞り込みが多い場合）
CREATE INDEX IF NOT EXISTS idx_<table_name>_user_id ON <table_name> (user_id);
CREATE INDEX IF NOT EXISTS idx_<table_name>_created_at ON <table_name> (created_at DESC);
```

## Store テンプレート

```typescript
// backend/src/stores/<feature>Store.ts
import { sql } from "../lib/db";
import type { Item } from "../types";

export const itemStore = {
  async get(id: string, userId: string): Promise<Item | null> {
    const rows = await sql<Item[]>`
      SELECT id, user_id as "userId", title, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM items
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return rows[0] ?? null;
  },

  async list(userId: string): Promise<Item[]> {
    return sql<Item[]>`
      SELECT id, user_id as "userId", title, description,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM items
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
  },

  async create(item: Omit<Item, "createdAt" | "updatedAt">): Promise<Item> {
    const now = new Date().toISOString();
    const rows = await sql<Item[]>`
      INSERT INTO items (id, user_id, title, description, created_at, updated_at)
      VALUES (${item.id}, ${item.userId}, ${item.title}, ${item.description ?? null}, ${now}, ${now})
      RETURNING id, user_id as "userId", title, description,
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    return rows[0];
  },

  async update(id: string, userId: string, patch: Partial<Pick<Item, "title" | "description">>): Promise<void> {
    await sql`
      UPDATE items
      SET title = COALESCE(${patch.title ?? null}, title),
          description = COALESCE(${patch.description ?? null}, description),
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
  },

  async delete(id: string, userId: string): Promise<void> {
    await sql`
      DELETE FROM items WHERE id = ${id} AND user_id = ${userId}
    `;
  },
};
```

## 既存テーブル

| テーブル | 概要 |
|---------|------|
| `users` | ユーザー（Cognito sub が主キー） |

---

## FXレビュー: テーブル（P0）

| マイグレーション | テーブル | メモ |
|-----------------|---------|------|
| `002_create_account_settings.sql` | `account_settings` | PK は `user_id`。行が無い = 未オンボーディング |
| `003_create_currency_pairs.sql` | `currency_pairs` | `UNIQUE(user_id, symbol)` |
| `004_create_tags.sql` | `tags` | `kind` は `rationale` / `emotion`。**`deleted_at` で論理削除**（削除してもトレードのタグを残すため。指示書§8からの追加列） |

金額は `BIGINT`（円）、価格・pip幅・割合は `NUMERIC`。storeのSQLで `::float8` にキャストして返す。
