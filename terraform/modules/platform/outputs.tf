output "api_endpoint" {
  value       = aws_apigatewayv2_stage.main.invoke_url
  description = "HTTP API ベース URL (Lambda バックエンド)。"
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.pool.id
  description = "Cognito User Pool ID。"
}

output "cognito_user_pool_client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "Cognito User Pool App Client ID (フロントエンド SDK 用)。"
}

output "cognito_hosted_ui_domain" {
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.aws_region}.amazoncognito.com"
  description = "Cognito Hosted UI ベースドメイン (Google OAuth ログイン起点)。"
}

output "frontend_bucket_name" {
  value       = aws_s3_bucket.frontend.bucket
  description = "フロントエンド静的資材の S3 バケット名 (CI デプロイターゲット)。"
}

output "frontend_cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.frontend.id
  description = "CloudFront Distribution ID (CI でのキャッシュ Invalidation 用)。"
}

output "frontend_url" {
  value       = local.frontend_base_url
  description = "フロントエンドの公開 URL。"
}

output "ssm_database_url_path" {
  value       = aws_ssm_parameter.database_url.name
  description = "DATABASE_URL の SSM パス。apply 後に正しい値を登録すること。"
}

output "lambda_role_arn" {
  value       = aws_iam_role.lambda_role.arn
  description = "Lambda 実行ロール ARN。"
}
