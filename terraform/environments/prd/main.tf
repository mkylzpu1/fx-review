module "platform" {
  source = "../../modules/platform"

  app_name    = var.app_name
  environment = "prd"
  aws_region  = var.aws_region

  lambda_runtime     = var.lambda_runtime
  lambda_memory_size = 1024
  lambda_timeout     = 30
  log_retention_days = 90 # prd は長めに保持

  frontend_domain_name           = var.frontend_domain_name
  cloudfront_acm_certificate_arn = var.cloudfront_acm_certificate_arn
  github_actions_role_arn        = var.github_actions_role_arn

  cognito_domain_prefix      = var.cognito_domain_prefix
  google_oauth_client_id     = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret

  monthly_budget_limit_usd = var.monthly_budget_limit_usd
  alert_notification_email = var.alert_notification_email

  tags = var.tags
}
