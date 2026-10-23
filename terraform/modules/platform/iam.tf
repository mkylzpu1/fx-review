# ============================================================
# Lambda 実行ロール（最小権限の原則）
#   - CloudWatch Logs（基本実行ロール）
#   - SSM Parameter Store（シークレット取得）
# ============================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${local.name_prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

# CloudWatch Logs への書き込み権限
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SSM Parameter Store アクセス
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "lambda_ssm" {
  statement {
    sid = "SSMGetParameters"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    resources = [
      "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/${var.environment}/*",
    ]
  }
}

resource "aws_iam_policy" "lambda_ssm" {
  name   = "${local.name_prefix}-lambda-ssm"
  policy = data.aws_iam_policy_document.lambda_ssm.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_ssm" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_ssm.arn
}

# TODO: 追加の権限が必要な場合はここに追加する
# 例: S3への読み書き、SESでのメール送信、など
