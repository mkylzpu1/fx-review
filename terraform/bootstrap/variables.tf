variable "app_name" {
  type        = string
  description = "Application name prefix used for AWS resource naming. e.g. 'my-app'"
}

variable "aws_region" {
  type        = string
  default     = "ap-northeast-1"
  description = "AWS region."
}

variable "github_repo" {
  type        = string
  description = "GitHub repository in owner/repo format (e.g. your-org/your-app)."
}

variable "create_github_oidc_provider" {
  type        = bool
  default     = true
  description = "Set false if the GitHub OIDC provider already exists in this AWS account."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Common tags applied to resources."
}
