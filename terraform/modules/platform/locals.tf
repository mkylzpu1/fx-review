locals {
  name_prefix = "${var.app_name}-${var.environment}"

  common_tags = merge(
    {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )

  # フロントエンドの公開URL。カスタムドメイン未指定時はCloudFrontのデフォルトドメインを使う。
  frontend_base_url = var.frontend_domain_name != "" ? "https://${var.frontend_domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"

  # Cognito Hosted UI ドメインプレフィックス。
  cognito_domain_prefix = var.cognito_domain_prefix != "" ? var.cognito_domain_prefix : "${local.name_prefix}-auth"

  # Lambda 共通環境変数。
  # 機密情報（DATABASE_URL 等）は SSM Parameter Store から取得するため、ここには含めない。
  # ssm.tf で登録したパスを環境変数として渡し、Lambda 側で aws-sdk を使って取得する。
  lambda_common_env = {
    COGNITO_USER_POOL_ID  = aws_cognito_user_pool.pool.id
    IS_LOCAL              = "false"
    LOG_LEVEL             = var.environment == "prd" ? "info" : "debug"
    ALLOWED_ORIGIN        = local.frontend_base_url
    SSM_DATABASE_URL_PATH = "/${var.app_name}/${var.environment}/DATABASE_URL"
    # TODO: 追加のSSMパスが必要な場合はここに追加する
    # SSM_MY_API_KEY_PATH = "/${var.app_name}/${var.environment}/MY_API_KEY"
  }
}
