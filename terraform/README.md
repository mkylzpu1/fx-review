# Terraform

AWS インフラを管理する Terraform 設定。

## ディレクトリ構成

```
terraform/
├── bootstrap/              # 初回のみ実行: Terraform state 用 S3 + DynamoDB + GitHub OIDC
└── environments/
│   ├── stg/               # STG 環境
│   └── prd/               # PRD 環境
└── modules/
    └── platform/          # STG/PRD 共通のインフラモジュール
        ├── api.tf          # Lambda + API Gateway
        ├── cognito.tf      # Cognito User Pool (Google OAuth)
        ├── frontend.tf     # S3 + CloudFront
        ├── iam.tf          # Lambda 実行ロール
        ├── ssm.tf          # SSM Parameter Store (シークレット管理)
        ├── cloudwatch.tf   # CloudWatch Log Groups
        ├── budget.tf       # AWS Budgets + SNS
        └── maintenance.tf  # 定期バッチ (EventBridge)
```

---

## 初回セットアップ手順

### 1. bootstrap（初回のみ）

Terraform state を保存する S3 バケットと、GitHub Actions 用 OIDC ロールを作成する。

```bash
cd terraform/bootstrap

# terraform.tfvars を作成
cat > terraform.tfvars << EOF
app_name    = "your-app-name"
github_repo = "your-org/your-repo"
EOF

terraform init
terraform apply
```

出力された `github_actions_role_arn_stg` / `github_actions_role_arn_prd` を次のステップで使う。

### 2. STG 環境を構築

```bash
cd terraform/environments/stg

cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集して値を設定する

# backend.tf の bucket / key / dynamodb_table を bootstrap の出力値に合わせて編集する

terraform init
terraform apply
```

### 3. シークレットを登録

```bash
aws ssm put-parameter \
  --name "/your-app-name/stg/DATABASE_URL" \
  --value "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  --type SecureString \
  --overwrite
```

### 4. PRD 環境を構築

```bash
cd terraform/environments/prd
# stg と同じ手順
```

---

## 新しい Lambda を追加する

1. `modules/platform/api.tf` の `locals.functions` と `locals.routes` に追加する
2. `sam/template.yaml` にも同じ関数を追加する（ローカル開発用）
3. `backend/build.mjs` の `handlers` 配列にエントリーポイントを追加する

## 新しいシークレットを追加する

1. `modules/platform/ssm.tf` に `aws_ssm_parameter` リソースを追加する
2. `modules/platform/locals.tf` の `lambda_common_env` に SSM パスを追加する
3. `modules/platform/variables.tf` に必要な変数を追加する

---

## 注意事項

- `terraform.tfvars` は機密情報を含むため `.gitignore` に含まれている
- `terraform/modules/platform/build/dummy.zip` は初回 apply 用のプレースホルダー。  
  実際の Lambda コードは CI/CD（GitHub Actions）でデプロイする
- PRD の `terraform apply` は main ブランチへのマージ後のみ実行すること
