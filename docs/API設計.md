# API設計

## 共通ルール

### ベースURL

| 環境 | URL |
|------|-----|
| ローカル | `http://localhost:3000` |
| 本番 | 環境変数 `VITE_API_URL` で管理 |

### 認証

全エンドポイント（`/auth/*` を除く）に `Authorization: Bearer {IdToken}` を必須とする。

Lambda側: `verifyAuth(event)` で検証する。  
フロント側: `apiClient` が自動的にトークンを付与する。

### レスポンス形式

**成功**:
```json
{
  "success": true,
  "data": { ... }
}
```

**エラー**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーの説明"
  }
}
```

### エラーコード一覧

| コード | HTTP | 意味 |
|--------|------|------|
| `VALIDATION_ERROR` | 400 | リクエストのバリデーション失敗 |
| `UNAUTHORIZED` | 401 | 認証失敗 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソース未存在 |
| `CONFLICT` | 409 | 状態の競合 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

---

## 既存エンドポイント

### 認証

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/auth/me` | ログインユーザー情報取得（初回はユーザー作成） |
| `DELETE` | `/auth/me` | 退会（ユーザーデータ削除） |
| `GET` | `/auth/registration-status` | ユーザー登録済みか確認 |

#### `GET /auth/me` レスポンス例

```json
{
  "success": true,
  "data": {
    "userId": "cognito-sub-xxxxx",
    "email": "user@example.com",
    "name": "山田太郎",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

---

## 新しいエンドポイントの追加手順

1. このドキュメントにエンドポイントを記載する
2. `backend/src/handlers/<feature>/` にハンドラーを実装する
3. `backend/build.mjs` の `handlers` 配列に追加する
4. `sam/template.yaml` にSAMリソースを追加する
5. フロントエンドに対応するAPIフック（`useQuery` / `useMutation`）を実装する

## エンドポイント設計テンプレート

```typescript
// backend/src/handlers/<feature>/list.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { verifyAuth } from "../../lib/cognito";
import { success, errorResponse } from "../../lib/response";
import { parseQuery } from "../../lib/validate";
import { logger } from "../../lib/logger";

const QuerySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v) : 20)),
  cursor: z.string().optional(),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const authUser = await verifyAuth(event);
    const query = parseQuery(event.queryStringParameters, QuerySchema);

    logger.info("GET /<feature>", { userId: authUser.userId });

    // const items = await featureStore.list(authUser.userId, query);
    return success({ items: [], nextCursor: undefined });
  } catch (e) {
    return errorResponse(e);
  }
};
```

```typescript
// frontend/src/features/<feature>/hooks/use<Feature>.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { Item } from "../types";

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => apiClient.get<{ items: Item[] }>("/items"),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string }) =>
      apiClient.post<Item>("/items", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
```
