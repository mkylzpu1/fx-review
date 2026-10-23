variable "app_name" {
  type        = string
  description = "Application name prefix used for AWS resource naming."
}

variable "environment" {
  type        = string
  description = "Deployment environment label (stg or prd)."
}

variable "aws_region" {
  type        = string
  default     = "ap-northeast-1"
  description = "AWS region for all resources."
}

variable "lambda_runtime" {
  type        = string
  default     = "nodejs20.x"
  description = "Node.js Lambda runtime version."
}

variable "lambda_memory_size" {
  type        = number
  default     = 1024
  description = "Lambda memory size in MB."
}

variable "lambda_timeout" {
  type        = number
  default     = 30
  description = "Default Lambda timeout in seconds."
}

# ─── Frontend / CloudFront ────────────────────────────────

variable "frontend_domain_name" {
  type        = string
  default     = ""
  description = "Optional custom domain for the frontend (e.g. app.example.com). If empty, the CloudFront default domain is used."
}

variable "cloudfront_acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN (must be in us-east-1) for frontend_domain_name. Required only if frontend_domain_name is set."
}

variable "github_actions_role_arn" {
  type        = string
  description = "IAM Role ARN assumed by GitHub Actions (OIDC). Granted deploy access to the frontend S3 bucket."
}

# ─── Cognito ──────────────────────────────────────────────

variable "cognito_domain_prefix" {
  type        = string
  default     = ""
  description = "Prefix for the Cognito Hosted UI domain (must be globally unique across AWS). Defaults to '<app_name>-<environment>-auth' if empty."
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 Client ID issued by Google Cloud Console for Sign in with Google."
}

variable "google_oauth_client_secret" {
  type        = string
  sensitive   = true
  description = "OAuth 2.0 Client Secret issued by Google Cloud Console for Sign in with Google."
}

# ─── SSM シークレット ──────────────────────────────────────
# TODO: 追加のシークレットが必要な場合は ssm.tf と合わせてここに追加する

# ─── Cost monitoring ─────────────────────────────────────

variable "monthly_budget_limit_usd" {
  type        = string
  default     = "10"
  description = "Monthly AWS cost budget limit in USD."
}

variable "alert_notification_email" {
  type        = string
  description = "Email address that receives budget and alarm notifications."
}

# ─── CloudWatch ───────────────────────────────────────────

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "CloudWatch Logs の保持日数。"
}

# ─── Common ───────────────────────────────────────────────

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags applied to resources."
}
