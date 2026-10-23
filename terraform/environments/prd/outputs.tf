output "api_endpoint" {
  value       = module.platform.api_endpoint
  description = "PRD HTTP API ベース URL。"
}

output "cognito_user_pool_id" {
  value       = module.platform.cognito_user_pool_id
  description = "PRD Cognito User Pool ID。"
}

output "cognito_user_pool_client_id" {
  value       = module.platform.cognito_user_pool_client_id
  description = "PRD Cognito User Pool App Client ID。"
}

output "cognito_hosted_ui_domain" {
  value       = module.platform.cognito_hosted_ui_domain
  description = "PRD Cognito Hosted UI ドメイン。"
}

output "frontend_bucket_name" {
  value       = module.platform.frontend_bucket_name
  description = "PRD フロントエンド S3 バケット名。"
}

output "frontend_cloudfront_distribution_id" {
  value       = module.platform.frontend_cloudfront_distribution_id
  description = "PRD CloudFront Distribution ID。"
}

output "frontend_url" {
  value       = module.platform.frontend_url
  description = "PRD フロントエンド URL。"
}

output "ssm_database_url_path" {
  value       = module.platform.ssm_database_url_path
  description = "PRD DATABASE_URL の SSM パス。apply 後に正しい値を登録すること。"
}
