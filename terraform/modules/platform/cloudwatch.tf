# ============================================================
# CloudWatch Logs
#
# Lambda 関数ごとに Log Group を明示的に管理する。
# Lambda が自動生成する Log Group に依存しないことで、
# 保持期間・タグを Terraform で確実に制御する。
# ============================================================

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.functions

  name              = "/aws/lambda/${local.name_prefix}-${replace(each.key, "_", "-")}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${local.name_prefix}-http-api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}
