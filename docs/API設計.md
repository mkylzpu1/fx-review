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

---

## FXレビュー: P0 エンドポイント

すべて認証必須。一覧系は `{ items: [...] }` を返す。

### 設定

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/settings` | 口座・リスク・チャート設定。**未作成なら `404 NOT_FOUND`**（オンボーディング判定に使う） |
| `PUT` | `/settings` | 設定の作成・更新。未作成のときは `balanceJpy` 必須。**初回作成時に通貨ペア USDJPY と既定の根拠・感情タグを投入する** |

`PUT /settings` ボディ（すべて任意。初回のみ `balanceJpy` 必須）:
`balanceJpy`(整数 >0), `maxRiskPct`(0〜100), `minRr`(>0), `timezone`, `chartDefaultTf`(`1m|5m|15m|1h|4h|1d`), `chartBarsBefore`, `chartBarsAfter`(1〜2000), `emaSettings`: `[{ period, visible }]`（最大8件、期間は重複不可）

### 通貨ペア

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/currency-pairs` | 一覧 |
| `POST` | `/currency-pairs` | 追加 `{ symbol, pipSize, pipValueJpyPerLot, showInPicker }`。同じ symbol は `409` |
| `PUT` | `/currency-pairs/{id}` | 更新（symbol は変更不可） |
| `DELETE` | `/currency-pairs/{id}` | 削除 |

### タグ

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/tags?kind=rationale\|emotion` | 一覧（削除済みは含まない） |
| `POST` | `/tags` | 追加 `{ kind, name }`。削除済みの同名タグは復活させる |
| `PUT` | `/tags/{id}` | 名前・並び順の更新 `{ name?, sortOrder? }` |
| `DELETE` | `/tags/{id}` | 論理削除（過去のトレードに付いたタグは残る） |

---

## FXレビュー: P1 エンドポイント

すべて認証必須。一覧系は `{ items, total, page, limit }`（ページング）を返す。

### ルール

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/rules` | 一覧（並び順どおり。無効なルールも含む） |
| `GET` | `/rules/{id}` | 1件取得（遵守率の推移・破ったトレードはP4で追加） |
| `POST` | `/rules` | 追加 `{ title, description?, autoKey?, isActive? }`。並び順は末尾 |
| `PUT` | `/rules/{id}` | 更新 `{ title?, description?, isActive?, sortOrder?, autoKey? }`。無効化しても過去の判定は残る |
| `DELETE` | `/rules/{id}` | 削除（そのルールの過去の判定も消える。通常は無効化を使う） |

`autoKey`: `sl_set` / `risk_within_limit` / `hold_to_tp` / `null`（手動チェック）

### トレード

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/trades` | 一覧。`result=win\|loss`, `deviationOnly=true`, `q`（メモ・理由・洞察の部分一致）, `pair`, `from`, `to`（ISO日時）, `pending=true`（入力のないトレードのみ）, `sort=entry_desc\|entry_asc\|pnl_desc\|pnl_asc`, `page`(1〜), `limit`(1〜100, 既定20) |
| `POST` | `/trades` | 新規作成。`draft: true` で下書き |
| `GET` | `/trades/{id}` | 詳細（導出値つき） |
| `PUT` | `/trades/{id}` | 更新（決済入力・書き足しもこれ） |
| `DELETE` | `/trades/{id}` | 論理削除（`POST .../restore` で取り消せる） |
| `POST` | `/trades/{id}/restore` | 削除の取り消し |
| `GET` | `/trades/queue` | 未入力キュー。`filter=all\|sl_tp\|no_rationale\|open\|loss`（`all` は「入力のないトレード」。それ以外は全トレードから条件で絞る: `sl_tp`=SLまたはTPが空、`no_rationale`=根拠タグなし、`open`=未決済、`loss`=損失）, `sort`, `page`, `limit`。`pendingCount`（入力のないトレード）・`totalCount`・`filledCount` も返す |

`POST` / `PUT` ボディ:
`pair`, `side`(`buy|sell`), `lots`(>0, 小数2桁), `entryAt`(ISO・オフセット付き), `entryPrice`,
任意: `slPrice`, `tpPrice`, `slReason`, `tpReason`, `rationaleMemo`, `confidence`(1〜5), `exitAt`, `exitPrice`, `exitMethod`(`tp|sl|manual|breakeven`), `insight`, `nextRule`, `draft`, `tagIds[]`, `ruleChecks[{ruleId,result}]`

検証: 買いのSLはエントリーより低く、売りは高く（TPは逆）。`exitAt` と `exitPrice` は両方そろえて送る。
RRが設定の最低値未満でも保存はできる（警告は画面側）。

レスポンス（TradeView）は保存値に加えて、導出値 `pips`, `rMultiple`, `plannedRr`, `riskJpy`, `riskPct`, `holdMinutes`, `ruleResults`, `deviation`, `isUnfilled`, `missing` を含む。SLが無いトレードの `rMultiple` / `plannedRr` / `riskJpy` / `riskPct` は `null`。

「入力のないトレード」（`isUnfilled`）の定義は `services/trade/unfilled.ts` の1か所:
**未決済、または SL・TP・根拠タグがいずれも空**。

---

## FXレビュー: P2 エンドポイント

### ローソク足

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/candles` | 保存済みの1分足（`candles_1m`）を指定の時間足に集計して返す。認証必須 |

クエリ:

| 名前 | 必須 | 説明 |
|------|------|------|
| `tf` | ○ | `1m` / `5m` / `15m` / `1h` / `4h` / `1d` |
| `from` | ○ | 表示範囲の開始（ISO日時・オフセット付き） |
| `to` | ○ | 表示範囲の終了（ISO日時。この時刻を含む足まで返す） |
| `warmup` | | `from` より前に追加で返す足の本数（EMAのウォームアップ用。0〜2000、既定0） |

レスポンス `data`:

```json
{
  "tf": "1h",
  "candles": [{ "time": 1760000000, "open": 150.1, "high": 150.2, "low": 150.0, "close": 150.15 }],
  "warmupCount": 120,
  "hasData": true,
  "mock": false
}
```

- `time` は足の開始時刻（UTCの秒）。`candles` は時刻の昇順
- `warmupCount`: 先頭から数えて、表示範囲（`from`）より前のウォームアップの足の本数。表示は `candles.slice(warmupCount)`、EMAの計算は全件で行う
- `hasData`: 範囲内（ウォームアップを除く）に足が1本以上あるか。週末・祝日、または未同期のときは `false`（`candles` は空でもよい）
- `mock`: 返した足にモックデータ（開発用の疑似データ）が含まれるか
- 5m / 15m / 1h はUTC区切り、4h / 1d はニューヨーク17:00区切り（`constants/candles.ts`）。取引のない時間は足を補完しない
- 範囲が広すぎる（足の本数が2000を超える、または集計に使う1分足が30万行を超える）ときは `400 VALIDATION_ERROR`（範囲を狭めるか、大きい時間足にする）
- 足は手元の同期スクリプト（`npm run candles:sync`）で入れる。Lambdaでの自動同期はしない
