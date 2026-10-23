# Project Template

React + TypeScript + AWS Lambda + PostgreSQL を使ったフルスタックWebアプリの開発テンプレート。  
新しいプロジェクトをAIとともに素早く立ち上げるための「開発基盤」として設計されている。

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| 状態管理 | TanStack Query（サーバー状態） + Zustand（クライアント状態） |
| フォーム | react-hook-form + Zod |
| 認証 | AWS Amplify v6 + Amazon Cognito + Google OAuth |
| Backend | AWS Lambda + Node.js 20 + TypeScript |
| DB | PostgreSQL（本番: Supabase、ローカル: Docker） |
| ローカル開発 | AWS SAM + Docker |
| STG / PRD インフラ | Terraform（`terraform/`）|
| テスト | Vitest + Testing Library |

---

## ディレクトリ構成

```
project-template/
├── README.md                  # このファイル（AI開発指示書を含む）
├── .gitignore
├── docker-compose.yml         # ローカルPostgreSQL
│
├── frontend/                  # Reactアプリケーション
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/        # 汎用UIコンポーネント（ErrorAlert, LoadingSpinner 等）
│   │   │   └── layout/        # レイアウトコンポーネント（AppLayout 等）
│   │   ├── constants/         # 定数（routes.ts 等）
│   │   ├── features/          # 機能単位のモジュール（後述）
│   │   ├── hooks/             # アプリ横断で使う共通カスタムフック
│   │   ├── services/          # APIクライアント等の外部通信処理
│   │   ├── stores/            # Zustandストア（クライアント状態）
│   │   ├── types/             # 共通型定義
│   │   └── utils/             # 純粋関数ユーティリティ
│   └── ...
│
├── backend/                   # Lambda関数群
│   ├── src/
│   │   ├── handlers/          # Lambdaエントリーポイント（薄く保つ）
│   │   │   └── auth/          # 認証ハンドラー（追加不要）
│   │   ├── services/          # ビジネスロジック
│   │   ├── stores/            # DB永続化処理（SQLのみ）
│   │   ├── lib/               # 共通基盤（cognito, db, logger, errors, response, validate）
│   │   ├── types/             # 共通型定義
│   │   └── utils/             # 純粋関数ユーティリティ
│   ├── db/migrations/         # SQLマイグレーションファイル
│   └── test/                  # テスト
│
├── sam/                       # ローカル開発用SAMテンプレート（Lambda APIをローカルで動かす）
├── script/                    # 開発用シェルスクリプト
└── terraform/                 # STG / PRD インフラ定義（ローカル開発では使わない）
    ├── bootstrap/             # 初回のみ実行: tfstate用S3・DynamoDB・GitHub OIDC作成
    ├── environments/
    │   ├── stg/               # STG環境
    │   └── prd/               # PRD環境
    └── modules/
        └── platform/          # STG/PRD共通モジュール（Lambda・API GW・Cognito・CloudFront等）
```

### features/ の構造（Frontend）

機能ごとにディレクトリを切り、その中に `components/`・`hooks/`・`pages/`・`utils/` を置く。

```
features/
├── auth/                      # 認証（初期から用意済み、基本的に変更不要）
│   ├── components/            # AuthProvider, RequireAuth, RequireGuest
│   ├── hooks/                 # useAuth
│   ├── pages/                 # LoginPage, CallbackPage
│   └── types.ts               # AuthUser
│
└── <feature-name>/            # 新機能はここに追加する
    ├── components/
    ├── hooks/
    ├── pages/
    └── utils/
```

---

## ローカル開発セットアップ

### 前提ツール

| ツール | バージョン |
|--------|-----------|
| Node.js | 20.x 以上 |
| npm | 10.x 以上 |
| Docker | 24.x 以上 |
| AWS SAM CLI | 1.x 以上 |

### 1. PostgreSQLを起動

```bash
docker compose up -d
```

### 2. DBテーブルを作成（初回のみ）

```bash
./script/setup-local-db.sh
```

### 3. Backendをセットアップ

```bash
cd backend
npm install
cp .env.local.example .env.local
# .env.local を必要に応じて編集
```

### 4. SAM APIを起動

```bash
cd sam
cp local-env.sample.json local-env.json
sam local start-api --env-vars local-env.json
```

`http://localhost:3000` でAPIが起動する。

### 5. Frontendをセットアップ

```bash
cd frontend
npm install
cp .env.example .env.local
```

`.env.local` にCognito設定を記入：

```env
VITE_API_URL=http://localhost:3000
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=https://your-domain.auth.ap-northeast-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_COGNITO_REDIRECT_SIGN_OUT_URI=http://localhost:5173/login
```

```bash
npm run dev
```

`http://localhost:5173` でフロントエンドが起動する。

---

## 開発コマンド

### Frontend

```bash
cd frontend
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run typecheck    # 型チェック
npm run lint         # Lint
npm run lint:fix     # Lint自動修正
npm run format       # Prettier整形
npm run test         # テスト実行
npm run quality      # lint:fix + format + typecheck を一括実行
```

### Backend

```bash
cd backend
npm run typecheck    # 型チェック
npm run lint         # Lint
npm run lint:fix     # Lint自動修正
npm run format       # Prettier整形
npm run test         # ユニットテスト
npm run test:integration  # インテグレーションテスト（要Docker）
npm run build        # Lambdaビルド（dist/ に出力）
npm run quality      # lint:fix + format + typecheck を一括実行
```

### Terraform（STG / PRD のみ。ローカル開発では不要）

**通常の terraform apply は GitHub Actions が自動実行する。手動実行は初回セットアップ時のみ。**

```bash
# 初回のみ手動実行
cd terraform/bootstrap && terraform init && terraform apply

cd terraform/environments/stg && terraform init && terraform apply
cd terraform/environments/prd && terraform init && terraform apply
```

---

## CI / CD

### ブランチ戦略とワークフロー

```
feature/* ──→ develop ──→ main
                │              │
                ▼              ▼
           Deploy STG     Deploy PRD
```

| ブランチ | トリガー | ワークフロー |
|---------|---------|------------|
| `feature/*` → `develop` PR | PR作成・更新 | `quality.yml`（lint/typecheck/test） |
| `terraform/**` 変更を含むPR | PR作成・更新 | `terraform-plan.yml`（planをPRにコメント） |
| `develop` へのpush（PRマージ） | push | `deploy-stg.yml`（STGへ自動デプロイ） |
| `main` へのpush（PRマージ） | push | `deploy-prd.yml`（PRDへ自動デプロイ） |

### 各ワークフローの処理内容

#### `quality.yml` — コード品質チェック

```
frontend: npm typecheck → lint → test
backend:  npm typecheck → lint → test
```

#### `terraform-plan.yml` — インフラ差分確認

```
STG / PRD それぞれの terraform plan を実行し、結果をPRにコメント投稿する
→ コードレビューでインフラ変更内容を確認できる
```

#### `deploy-stg.yml` / `deploy-prd.yml` — デプロイ

```
1. terraform apply      インフラを最新化
        ↓
2. backend build        esbuildでLambdaをバンドル
   → Lambda update      各関数にzipをアップロード
        ↓（並列）
3. frontend build       Viteでビルド（環境変数をCIで注入）
   → S3 sync            dist/ をバケットに同期
   → CloudFront無効化   キャッシュをクリア
```

### GitHub Secrets の設定

リポジトリの Settings → Secrets → Actions に以下を登録する。

**AWS認証（bootstrap で作成したIAMロールARN）**

| Secret名 | 内容 |
|---------|------|
| `AWS_DEPLOY_ROLE_ARN_STG` | STG用 GitHub Actions IAM ロール ARN |
| `AWS_DEPLOY_ROLE_ARN_PRD` | PRD用 GitHub Actions IAM ロール ARN |

**Google OAuth**

| Secret名 | 内容 |
|---------|------|
| `GOOGLE_OAUTH_CLIENT_ID_STG` | STG用 Google OAuth クライアントID |
| `GOOGLE_OAUTH_CLIENT_SECRET_STG` | STG用 Google OAuth クライアントシークレット |
| `GOOGLE_OAUTH_CLIENT_ID_PRD` | PRD用 Google OAuth クライアントID |
| `GOOGLE_OAUTH_CLIENT_SECRET_PRD` | PRD用 Google OAuth クライアントシークレット |

**Cognito（terraform apply後に確認できる値）**

| Secret名 | 内容 |
|---------|------|
| `COGNITO_USER_POOL_ID_STG` | STG Cognito User Pool ID |
| `COGNITO_CLIENT_ID_STG` | STG Cognito App Client ID |
| `COGNITO_DOMAIN_STG` | STG Cognito Hosted UI ドメイン |
| `FRONTEND_URL_STG` | STGフロントエンドURL（例: `https://xxxx.cloudfront.net`） |
| `COGNITO_USER_POOL_ID_PRD` | PRD Cognito User Pool ID |
| `COGNITO_CLIENT_ID_PRD` | PRD Cognito App Client ID |
| `COGNITO_DOMAIN_PRD` | PRD Cognito Hosted UI ドメイン |
| `FRONTEND_URL_PRD` | PRDフロントエンドURL（例: `https://app.example.com`） |

---

## アーキテクチャ

### インフラの使い分け

| 環境 | API | DB | フロントエンド |
|------|-----|----|--------------|
| ローカル | AWS SAM（`sam local start-api`） | Docker PostgreSQL | Vite Dev Server |
| STG / PRD | API Gateway + Lambda（Terraform管理） | Supabase PostgreSQL | S3 + CloudFront（Terraform管理） |

**ローカル開発では `terraform/` は一切使わない。** SAMがAPI Gatewayの代わりになる。

### Backend の責務分離

```
Request
  └─ handlers/     リクエストのパース・認証・レスポンス組み立て（薄く保つ）
       └─ services/ ビジネスロジック（純粋関数に近い形で書く）
            └─ stores/  DB永続化（SQLのみ。ロジックは書かない）
```

- `handlers/` に複雑なロジックを書かない。ビジネスロジックは `services/` に切り出す
- `stores/` は SQL の実行のみ。if文や計算ロジックは書かない
- `lib/` の共通処理（`verifyAuth`, `success`, `errorResponse` 等）は必ず使う

### Frontend の責務分離

```
pages/        ページコンポーネント（レイアウト・コンポーネントの組み立て）
  └─ components/  UIコンポーネント（表示に専念、副作用なし）
hooks/        データフェッチ・状態管理（TanStack Query / Zustand）
services/     API通信（apiClient 経由で統一）
```

---

## コーディングルール

### TypeScript

- `any` は禁止（`@typescript-eslint/no-explicit-any: warn`）
- `as any` のような型強制は原則禁止
- 型は使う場所の近くに定義し、複数箇所で使う型だけ `types/` に移動する

### ファイル分割

- 1ファイル300行を超えたら分割を検討する
- UIとロジックを同一ファイルに混在させない（`Component.tsx` にビジネスロジックを書かない）
- 同じ処理が2箇所以上に現れたら共通化する

### 命名規則

| 対象 | 規則 | 例 |
|------|------|----|
| Reactコンポーネント | PascalCase | `UserCard.tsx` |
| カスタムフック | camelCase（use〜） | `useUser.ts` |
| 汎用関数 | camelCase | `formatDate.ts` |
| 型・インターフェース | PascalCase | `User`, `ApiResponse` |
| 定数 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Lambdaハンドラー | ファイル名＝機能名 | `me.ts`, `withdrawal.ts` |

---

## エラーハンドリング

### Backend

`lib/errors.ts` に定義済みのエラークラスを使う：

| クラス | HTTP | 用途 |
|--------|------|------|
| `ValidationError` | 400 | リクエスト不正 |
| `UnauthorizedError` | 401 | 認証失敗 |
| `ForbiddenError` | 403 | 権限不足 |
| `NotFoundError` | 404 | リソース未存在 |
| `ConflictError` | 409 | 状態の競合 |
| `InternalError` | 500 | 予期しないエラー |

ハンドラーの catch では必ず `errorResponse(e)` を使う：

```typescript
export const handler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    // ...
    return success(data);
  } catch (e) {
    return errorResponse(e); // ← 常にこれ
  }
};
```

### Frontend

- API エラーは `ApiError`（`services/apiClient.ts`）でキャッチする
- TanStack Queryの `onError` / `isError` で画面にフィードバックする
- `<ErrorAlert>` コンポーネントで表示を統一する

---

## API設計ルール

新しいAPIを追加する場合は以下のルールに従う。

### URL設計

```
GET    /resources          一覧取得
POST   /resources          新規作成
GET    /resources/:id      単件取得
PUT    /resources/:id      更新
DELETE /resources/:id      削除
```

### レスポンス形式

**成功**:
```json
{ "success": true, "data": { ... } }
```

**エラー**:
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "説明" } }
```

`success()` と `errorResponse()` を使えば自動的にこの形式になる。

---

## DB設計ルール

- マイグレーションファイルは `backend/db/migrations/` に連番で追加する
- テーブル名・カラム名は `snake_case`
- `stores/` のSQLではカラム名をTypeScriptの `camelCase` にエイリアスして返す

```sql
SELECT user_id as "userId", created_at as "createdAt" FROM users
```

---

## テスト方針

### ユニットテスト（`test/unit/`）

- `lib/cognito` と `stores/` は必ずモックする
- ハンドラーの正常系・異常系を網羅する
- 外部依存（DB, Cognito）はモックする

### インテグレーションテスト（`test/integration/`）

- 実際のDBに接続して動作確認する
- テスト前後にデータをクリーンアップする
- `docker compose up -d` が必要

---

---

# AI Development Instructions

このテンプレートを使って新しいプロジェクトを開発する場合、**以下のルールに必ず従うこと**。

---

## 鉄則1: 実装前に既存コードを調査する

コードを書く前に、必ず以下を確認する：

1. **ディレクトリ構成** — どこに何があるかを把握する
2. **共通処理** — `lib/`, `services/`, `hooks/`, `utils/` に同じ処理がないか確認する
3. **型定義** — `types/` に使える型がないか確認する
4. **API** — 既存のエンドポイント設計に合っているか確認する
5. **エラーハンドリング** — `lib/errors.ts` のクラスを使えないか確認する

既存実装を理解せずに新しい仕組みを作ってはいけない。

---

## 鉄則2: ディレクトリ構成を勝手に変えない

新しいファイルを追加するときは、必ず既存の責務分離に従う。

| 追加する内容 | 置く場所 |
|-------------|---------|
| 新しい機能のページ | `frontend/src/features/<feature>/pages/` |
| 新しい機能のフック | `frontend/src/features/<feature>/hooks/` |
| 汎用UIコンポーネント | `frontend/src/components/common/` |
| APIクライアント処理 | `frontend/src/services/` |
| Lambda ハンドラー | `backend/src/handlers/<feature>/` |
| ビジネスロジック | `backend/src/services/` |
| DB処理 | `backend/src/stores/` |

---

## 鉄則3: ファイルを巨大化させない

以下の場合は分割する：

- 1ファイルが300行を超えた
- UIとロジックが混在している（ページコンポーネントに直接SQLや計算ロジックを書いていない）
- 同じ処理が2箇所以上に書かれている

---

## 鉄則4: 共通処理を再利用する

### Backend で必ず使うもの

```typescript
import { verifyAuth } from "../../lib/cognito";      // 認証
import { success, errorResponse } from "../../lib/response"; // レスポンス
import { parseBody, parseQuery } from "../../lib/validate";  // バリデーション
import { logger } from "../../lib/logger";            // ログ
import { ValidationError, NotFoundError, ... } from "../../lib/errors"; // エラー
import { sql } from "../../lib/db";                   // DB接続
```

### Frontend で必ず使うもの

```typescript
import { apiClient } from "@/services/apiClient";    // API通信
import { useAuthContext } from "@/features/auth/components/AuthProvider"; // 認証情報
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorAlert } from "@/components/common/ErrorAlert";
```

---

## 鉄則5: 型安全性を維持する

```typescript
// ✅ 良い
const user: User = await userStore.get(userId);

// ❌ 悪い
const user: any = await userStore.get(userId);
const user = await userStore.get(userId) as any;
```

---

## 鉄則6: 秘密情報をコードに書かない

```typescript
// ❌ 絶対禁止
const apiKey = "sk-xxxxxxxxxxxx";

// ✅ 正しい
const apiKey = process.env.API_KEY;  // backend
const apiKey = import.meta.env.VITE_API_KEY;  // frontend
```

新しい環境変数が必要なら:

- Backend: `backend/.env.local.example` に追記、`sam/local-env.sample.json` にも追記
- Frontend: `frontend/.env.example` に追記

---

## 鉄則7: APIとDBの設計ルールを守る

- レスポンスは `success()` / `errorResponse()` のみを使う
- マイグレーションは `backend/db/migrations/` に連番ファイルで追加する
- 新しいハンドラーを追加したら **以下の3箇所すべて** に追記する：
  1. `backend/build.mjs` の `handlers` 配列
  2. `sam/template.yaml`（ローカル開発用）
  3. `terraform/modules/platform/api.tf` の `locals.functions` / `locals.routes`（STG/PRD用）

---

## 鉄則8: CI/CDの仕組みを壊さない

### ブランチ運用

- `feature/*` → `develop` → `main` の順でPRを出す
- `develop` へのマージでSTGに自動デプロイされる
- `main` へのマージでPRDに自動デプロイされる
- `main` に直接pushしない

### ワークフローファイルを変更するとき

`.github/workflows/` を変更する場合は以下を確認する：

- `deploy-stg.yml` と `deploy-prd.yml` の対称性を保つ（STGとPRDの処理内容を揃える）
- 新しいSecretが必要になったら README の「GitHub Secrets の設定」テーブルにも追記する
- 新しいTerraform変数（`TF_VAR_*`）を追加したら `variables.tf` と `terraform.tfvars.example` にも追記する

### 環境変数の注入タイミング

| 変数の種類 | 注入場所 |
|-----------|---------|
| フロントエンドのビルド時変数（`VITE_*`） | CI（GitHub Actions）で注入。`.env.local` には書かない |
| バックエンドの機密情報（DB URLなど） | SSM Parameter Store。Lambdaが起動時に取得 |
| ローカル開発用 | `backend/.env.local` / `frontend/.env.local`（gitignore済み） |

---

---

# 新規プロジェクト作成時のAI指示テンプレート

このテンプレートをコピーして新しいプロジェクトを始めるとき、AIに渡す指示のひな型。

---

```markdown
## 開発依頼

このリポジトリはプロジェクト開発用テンプレートです。
README の「AI Development Instructions」セクションのルールを必ず守ってください。

---

### プロジェクト概要

[ここにプロジェクトの目的と概要を記載]

---

### 必要な機能

- [機能1: 例) ユーザーが〇〇を登録できる]
- [機能2: 例) 一覧を表示して検索できる]
- [機能3: 例) 詳細ページで編集・削除できる]

---

### 技術要件

- [必要な外部サービス: 例) Stripe, SendGrid 等]
- [特別な要件: 例) オフライン対応が必要]

---

### 実装前に必ず行うこと

1. リポジトリ全体を確認し、現在の構成を把握する
2. 既存の共通処理（lib/, hooks/, services/, utils/）を確認する
3. 既存の型定義を確認する
4. 実装方針を提示してから実装を開始する

---

### 完了条件

- [ ] 型エラーがない（`npm run typecheck`）
- [ ] lintエラーがない（`npm run lint`）
- [ ] テストが通る（`npm test`）
- [ ] ビルドが通る（`npm run build`）
- [ ] 不要なコードが残っていない
- [ ] 重複実装がない
- [ ] README の AI Development Instructions に違反していない
- [ ] 新しいハンドラーを追加した場合、`build.mjs` / `sam/template.yaml` / `terraform/modules/platform/api.tf` の3箇所に追記した
- [ ] 新しいSecretが必要な場合、README の「GitHub Secrets の設定」テーブルに追記した
```

---

## 設計書

`docs/` 以下を参照。

- [アーキテクチャ.md](docs/アーキテクチャ.md) — 設計思想・認証フロー・状態管理
- [DB設計.md](docs/DB設計.md) — テーブル設計テンプレート
- [API設計.md](docs/API設計.md) — エンドポイント設計ガイド
