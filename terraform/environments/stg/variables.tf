variable "app_name" {
  type        = string
  description = "Application name prefix used for AWS resource naming."
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

variable "frontend_domain_name" {
  type        = string
  default     = ""
  description = "Optional custom domain for the frontend. Empty = CloudFront default domain."
}

variable "cloudfront_acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN (us-east-1). Required only if frontend_domain_name is set."
}

variable "github_actions_role_arn" {
  type        = string
  description = "IAM Role ARN assumed by GitHub Actions (OIDC) to deploy the frontend."
}

variable "cognito_domain_prefix" {
  type        = string
  default     = ""
  description = "Prefix for the Cognito Hosted UI domain (globally unique across AWS)."
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 Client ID issued by Google Cloud Console."
}

variable "google_oauth_client_secret" {
  type        = string
  description = "OAuth 2.0 Client Secret issued by Google Cloud Console."
  sensitive   = true
}

variable "monthly_budget_limit_usd" {
  type        = string
  default     = "10"
  description = "Monthly AWS cost budget limit in USD."
}

variable "alert_notification_email" {
  type        = string
  description = "Email address that receives budget and alarm notifications."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags applied to resources."
}
