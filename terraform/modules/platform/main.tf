# ============================================================
# platform module
#
# リソースはドメインごとに分割された *.tf ファイルで管理する:
#   frontend.tf   - S3 + CloudFront (OAC) によるフロントエンド配信
#   cognito.tf    - Cognito User Pool (Google OAuth)
#   api.tf        - Lambda 関数群 + API Gateway (HTTP API)
#   iam.tf        - Lambda 実行ロール / ポリシー
#   ssm.tf        - SSM Parameter Store (シークレットのプレースホルダー)
#   cloudwatch.tf - CloudWatch Log Groups
#   budget.tf     - AWS Budgets + SNS 通知
#   maintenance.tf- 定期バッチ (EventBridge Scheduler)
#   outputs.tf    - module outputs
#
# ─── 新しい Lambda を追加する手順 ───────────────────────────
# 1. api.tf の locals.functions に関数定義を追加する
# 2. api.tf の locals.routes にルート定義を追加する
# 3. sam/template.yaml にも同じ関数を追加する（ローカル開発用）
# 4. backend/build.mjs の handlers 配列にエントリーポイントを追加する
# ============================================================
