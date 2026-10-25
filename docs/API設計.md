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
| `GET` | `/rules/{id}` | ルール詳細（遵守率の推移・破ったトレード・守った/破った時の平均R）。レスポンスは下記 |
| `POST` | `/rules` | 追加 `{ title, description?, autoKey?, isActive? }`。並び順は末尾 |
| `PUT` | `/rules/{id}` | 更新 `{ title?, description?, isActive?, sortOrder?, autoKey? }`。無効化しても過去の判定は残る |
| `DELETE` | `/rules/{id}` | 削除（そのルールの過去の判定も消える。通常は無効化を使う） |

`GET /rules/{id}` レスポンス `data`:

- `rule`: ルール本体（一覧と同じ項目）
- `kept` / `broke`: 判定のあるトレード（決済済み）の守った件数 / 破った件数。判定なし（`na`・未入力）は数えない
- `recent`: 直近4週（今週を含む）の `kept` / `broke` / `rate`（遵守率%。判定が無ければ `null`）
- `weekly`: 直近8週（古い順・今週を含む。月〜日・JST）の `weekStart` / `kept` / `broke` / `rate`
- `avgKept` / `avgBroken`: 守った時・破った時の平均R（`{ n, avgR }`。Rが計算できるトレードだけ）
- `brokenTrades`: 破ったトレード（新しい順・最大20件）と、全件数 `brokenTotal`
- `validation`: 学習メモからルール化した「検証中」のルールなら前後の成績比較（それ以外は `null`）
- 遵守率 = 守った ÷（守った + 破った）。無効化したルールの過去の判定も集計に残る

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

### トレードの MFE / MAE / 決済後の最大到達

`GET /trades/{id}` などのレスポンスの `mfePips` / `maePips` / `afterMaxPips`（保存値。pips、小数1桁）。

- `mfePips`: 保有中の最大含み益（0以上）。`maePips`: 保有中の最大含み損（0以下）。どちらも1分足の高値・安値で、エントリーの分〜決済の分を含めて計算する
- `afterMaxPips`: 決済後、**決済価格からさらに有利方向へ**進んだ最大幅（0以上）。見る長さは設定の「決済後の表示本数 × 初期の時間足」
- 該当期間の1分足が無い、または保有区間の端が10分以上欠けているとき、および未決済のときは `null`（画面は「—」）
- 計算するタイミング: `POST /trades` / `PUT /trades/{id}` の保存後、および `npm run candles:sync` の完了後（同期した期間にエントリーした決済済みトレード）。失敗しても保存は成功する

---

## FXレビュー: P3 エンドポイント（CSV取り込み）

楽天FX証券の約定履歴CSV（Shift_JIS）を取り込む。文字コードの変換はブラウザ（`TextDecoder("shift_jis")`）で行い、APIには変換後のテキストを送る。API Gatewayのペイロード上限（10MB）があるため、本文の合計は800万文字まで（超えると `400 VALIDATION_ERROR`）。

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/imports/preview` | パース・ペアリング・重複判定だけ行い、保存せずに結果を返す。認証必須 |
| `POST` | `/imports/commit` | 同じ入力で確定する。重複の扱いを `duplicateMode` で指定。認証必須 |

リクエスト（共通）:

```json
{
  "files": [{ "name": "execution-7.csv", "text": "\"約定No.\",\"通貨ペア\",..." }],
  "duplicateMode": "skip"
}
```

- `files`: 1〜20個。`name` は表示用、`text` はデコード済みのCSV本文
- `duplicateMode`（commit のみ・必須）: `skip`（取り込み済みを除いて取り込む）/ `overwrite`（取り込み済みの価格・損益だけCSVの値で更新。根拠・メモ・SL・TPは残す）

### ペアリング（`services/import/pairing.ts`）

- 約定No.の昇順に並べ、新規行を売買ごとのキューに入れ、決済行は**逆の売買のキュー先頭（FIFO）**とペアにする（決済 `売` → 買いポジション）。隣の行とはペアにしない
- 決済に対応する新規が無い／数量が一致しない → エラー行（分割決済は対象外）
- 決済されていない新規 → `status: "open"` のトレード
- 複数ファイルで重なる同じ約定No.は1件にする（`overlappedRows`）
- `source_key = "rakuten:" + 新規の約定No + ":" + 決済の約定No`（未決済は決済No.が空）
- 数量は1,000通貨（0.1 lot）単位のみ（1 lot = 10,000通貨）。通貨ペアは `ドル/円`（USDJPY）のみ。ほかは行ごとのエラー
- ファイルに `約定日時` などの必須列が無い（別形式）ときは、そのファイルだけ `status: "error"`。他のファイルは取り込める

### 重複判定

| `importStatus` | 意味 | commit での扱い |
|---|---|---|
| `new` | 未取り込み | 追加する |
| `duplicate` | 同じ `source_key` が取り込み済み（削除済みのトレードも含む） | `skip`: 何もしない / `overwrite`: 価格・損益を更新 |
| `completes_open` | 未決済で取り込み済みだった新規が、今回のCSVで決済済みになった | どちらのモードでも決済を埋める（根拠・メモ・SL・TPは残す。保存済みのMFE/MAEは消し、次の同期で再計算） |

### `POST /imports/preview` レスポンス `data`

```json
{
  "files": [{ "name": "execution-7.csv", "status": "ok", "rowCount": 422, "message": null }],
  "summary": {
    "total": 211, "newCount": 200, "duplicateCount": 11, "completesOpenCount": 0,
    "openCount": 0, "errorCount": 0, "overlappedRows": 0
  },
  "trades": [{ "sourceKey": "rakuten:1000:1001", "importStatus": "new", "side": "buy", "lots": 1, "entryAt": "2026-10-01T13:10:00Z", "entryPrice": 150.1, "exitAt": "2026-10-01T13:30:00Z", "exitPrice": 150.2, "pnlJpy": 1000, "status": "closed", "entryNo": "1000", "exitNo": "1001", "pair": "USDJPY" }],
  "errors": [{ "file": "execution-7.csv", "line": 12, "executionNo": "1234", "message": "…" }],
  "entryRange": { "from": "2026-10-01T13:10:00Z", "to": "2026-10-23T06:21:00Z" }
}
```

- `summary` は全件の集計。`trades` は**エントリーが新しい順に先頭100件だけ**、`errors` は先頭200件だけ返す（`summary.errorCount` が全件数）。全件をフロントに送って絞り込まない
- `entryRange`（UTC）: ローソク足の同期（`npm run candles:sync`）の範囲の案内に使う

### `POST /imports/commit` レスポンス `data`

```json
{ "imported": 200, "skipped": 11, "overwritten": 0, "completedOpen": 0, "errorCount": 0, "files": [], "entryRange": {} }
```

- `skipped`: `skip` のとき、取り込み済みのため除いた件数
- `overwritten`: `overwrite` のとき、更新した件数
- 取り込み後、`npm run candles:sync -- --from <entryRange.from の日付> --to <entryRange.to の日付>` で足を同期するとチャートとMFE/MAEが出る

## FXレビュー: P4 エンドポイント（分析）

### 統計

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/stats?from=&to=&pair=` | 期間・通貨ペアで絞った統計。認証必須。`from` / `to` はISO日時（任意） |

レスポンス `data`:

```json
{
  "summary": { "n": 120, "winRate": 55.0, "totalPips": 310.5, "totalPnlJpy": 31000, "rCount": 40, "rMissing": 80, "avgR": 0.31, "totalR": 12.4, "profitFactor": 1.4, "maxLossStreak": 5 },
  "cumulative": [{ "index": 1, "entryAt": "…", "r": 1.2, "cumulative": 1.2 }],
  "drawdown": { "depth": 3.1, "peakIndex": 10, "troughIndex": 18 },
  "bySession": [{ "key": "tokyo", "label": "東京", "n": 20, "avgR": 0.4, "verdict": "strength", "shortfall": 0 }],
  "byRationale": [], "byRule": [],
  "insights": [{ "kind": "needs_check", "axis": "session", "label": "NY", "n": 6, "avgR": -0.2, "shortfall": 9 }],
  "closedCount": 120
}
```

- 集計対象は**決済済みで pips が計算できるトレード**。勝率・pips・円損益は全件、R系（累積R・平均R・PF・最大DD）は **R が計算できるトレードだけ**。`rMissing` が「R未計算」の件数
- `drawdown`: 累積Rのピークからの最大下落。`peakIndex` / `troughIndex` は累積Rのトレード番号（0は開始時点）。下落が無ければ `null`
- `verdict`: `n ≥ 15` なら平均Rの符号で `strength` / `weakness`、それ未満は `needs_check`（`shortfall` はあと何件ほどで判断できるか）。閾値は `constants/stats.ts`
- 根拠タグ別: 複数タグのトレードは各タグに数える。タグが無いものは「未入力」にまとめ、`insights` には含めない
- ルール遵守別: 有効なルールに `ng` が1つでもあれば「破った」、`ok` があれば「守った」、どちらも無ければ「判定なし」
- セッションはエントリー時刻（設定のタイムゾーン）で分類。区分は `constants/sessions.ts`（仮値）

### 週次レビュー

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/weekly-review?weekStart=YYYY-MM-DD` | その週（月〜日・JST）の集計と、保存済みのふりかえり。`weekStart` を省くと今週。月曜でない日付は、その日を含む週の月曜にそろえる |
| `PUT` | `/weekly-review?weekStart=YYYY-MM-DD` | ふりかえり（`memo`）と、来週守るルール（`nextRuleId` または `nextRuleText`）を保存。`weekStart` 必須 |

`GET` レスポンス `data`: `weekStart` / `weekEnd`、`n`・`winRate`・`totalR`・`rCount`・`rMissing`・`totalPips`、`rule`（守った/破った/判定なしの件数）、`days`（日別の件数・R）、`planned`（計画どおりR）、`trades`（その週のトレード、新しい順）、`comments`、`fewTrades`、`review`（未保存なら `null`）、`rules`（有効なルールの候補）。

- 集計対象は決済済みで pips があるトレード。R系は R が計算できるものだけ（`rMissing` が未計算の件数）
- `planned`（計画どおりに持っていたら）: **TPが入っていて R が計算できる手動決済**だけを、計画のリスクリワードで決済したと仮定した週の合計R。対象外の手動決済は `excludedCount` で併記。`emotions` は対象トレードの感情タグ
- `fewTrades`: 5件未満の週。コメントは「傾向ではなく見直しの材料」と注記する

### エクスポート

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/export` | AIに貼り付ける用などの出力を文字列で返す。認証必須 |

リクエスト:

```json
{
  "range": "all",
  "format": "markdown",
  "include": { "result": true, "planDiff": true, "rationale": true, "ruleChecks": true, "reflection": true, "market": true }
}
```

- `range`: `all` / `30d`（直近30日）/ `month`（今月。表示タイムゾーンの月初から）
- `format`: `markdown`（既定。依頼文・ルール・集計・一覧・分析の依頼）/ `csv`（トレード一覧のみ）/ `json`（全項目）
- `include`（省略した項目はON）: 列のグループ。`id`・日時・通貨ペア・方向・エントリーは常に出す
  - `result`: 決済価格・決済方法・pips・R・ロット・損益円・保有分・MFE・MAE・決済後最大到達
  - `planDiff`: SL・TP・計画RR・想定リスク円/%・SL/TPの理由
  - `rationale`: 根拠タグ・根拠メモ / `ruleChecks`: ルール逸脱 / `reflection`: 感情・確信度・気づき・次回のルール / `market`: 曜日・セッション
- 複数タグは `|` 区切り。未入力の列は空欄。自由記述の先頭が `= + - @` のときは `'` を付ける（表計算ソフトで式として解釈されないため）
- Markdown の冒頭の集計に「SL入力あり n件 / 全 N件」「根拠タグあり n件」「R未計算 n件」を載せる
- **未対応**: エントリー前後のローソク足・EMA値、ボラティリティ（ATR）・上位足の向き（足の同期データが必要なため、後続で対応）

レスポンス `data`: `{ "content": "…", "filename": "fx-review-2026-10-24.md", "mime": "text/markdown", "tradeCount": 120 }`

### 学習メモ

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/notes?kind=&validating=&page=&limit=` | 一覧。`kind`: `ai` / `self`。`validating=true` はルール化した改善案を含むメモだけ。新しい順 |
| `GET` | `/notes/{id}` | 詳細（改善案・AI回答の見出し分け `sections` つき） |
| `POST` | `/notes` | 自分の気づきを作る（`title`, `body`, `emotionTags`, `nextRule`, `sourceTradeId`） |
| `POST` | `/notes/ai` | AIの回答を貼り付けて保存。改善案を簡易パースで取り出す |
| `PUT` / `DELETE` | `/notes/{id}` | 更新 / 削除（改善案も消える。作成済みのルールは残る） |
| `POST` | `/notes/{id}/improvements/{improvementId}/to-rule` | 改善案をルールにする（検証中として始まる）。ルール化済みなら `409` |
| `GET` | `/notes/validations` | 検証中の改善ルール（ルール化後の件数 / 目標、前後の平均R、守った時・破った時の平均R） |

`POST /notes/ai` リクエスト: `{ "aiName": "Claude", "dataRangeLabel": "直近30日", "rawResponse": "…", "title": null }`

- `aiName`: `Claude` / `ChatGPT` / `Gemini` / `その他`。`rawResponse` は10万文字まで
- **簡易パース**（LLMは呼ばない）: 番号付き行（`1.` `1)` `①`）と箇条書き（`-` `*` `・`）を1行ずつ改善案にする。「改善」「ルール」「提案」などの見出しの節があればそこだけから拾い、無ければ全体から拾う。同じ行は1つにまとめ、300文字で切り、30件まで。`n=12` / `（12件）` があれば `sampleN` にする
- パースできない回答は、改善案も `sections` も空で、原文（`rawResponse`）だけを返す。画面は原文表示にフォールバックする
- 改善案の `status`: `needs_check`（要検証）/ `ruled`（ルール化済み）。`ruled` のときは `validation: { count, target }`（ルール化後の件数 / 目標）が付く
- ルール化: ルール作成と改善案の更新は同じトランザクション。作成時に `validation_started_at` を記録する

### バックアップ・全データ削除

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/backup` | 本人のデータをまとめて返す（設定・通貨ペア・タグ・ルール・トレード・タグ付け・ルール判定・学習メモ・改善案・週次レビュー）。ローソク足は共有データなので含めない |
| `POST` | `/backup/restore` | バックアップの内容で**いまのデータを置き換える**。全部成功か、何も変えないかのどちらか |
| `DELETE` | `/data` | 本人のデータをすべて削除する。ユーザー自体は残る（設定も消えるので、次はオンボーディングから） |

- `GET /backup` の `data`: `{ app: "fx-review", version: 1, exportedAt, data: { <テーブル名>: [行…] } }`。行はDBのカラム名（`snake_case`）のまま
- `POST /backup/restore` のボディは上記ファイルそのまま。`app` が違う・`version` が非対応・欠けたテーブルは空として扱う
- 復元時、各行の `user_id` は**常に本人に上書き**する（ファイル内の値は信用しない）。ほかの行を指す参照（タグ付け・ルール判定・改善案・週次レビューの次ルール・メモの元トレード）が**ファイル内に無ければ400**で拒否する（他人のデータを指させないため）
- DBが型の不一致などで失敗したら、トランザクションを巻き戻して400（「いまのデータは変わっていません」）
- 復元は件数 `{ trades }` を返す
