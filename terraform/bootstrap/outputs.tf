output "state_bucket_name" {
  value       = aws_s3_bucket.tfstate.bucket
  description = "Terraform state S3 bucket name."
}

output "lock_table_name" {
  value       = aws_dynamodb_table.tflock.name
  description = "Terraform state lock DynamoDB table name."
}

output "github_actions_role_arn_stg" {
  value       = aws_iam_role.github_actions_stg.arn
  description = "GitHub Actions deploy role ARN for STG. Set this in environments/stg/terraform.tfvars."
}

output "github_actions_role_arn_prd" {
  value       = aws_iam_role.github_actions_prd.arn
  description = "GitHub Actions deploy role ARN for PRD. Set this in environments/prd/terraform.tfvars."
}
