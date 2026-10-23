# ============================================================
# SSM Parameter Store
#
# 機密情報はここで SecureString のプレースホルダーとして管理する。
# 実際の値は terraform apply 後に手動または CI/CD で登録する。
#
# パス規則: /${app_name}/${environment}/<KEY>
#
# 注意: value に "CHANGE_ME" が残っている場合、Lambda は起動に失敗する。
#       apply 後、必ず正しい値を登録すること。
#
# 登録コマンド例:
#   aws ssm put-parameter \
#     --name "/${app_name}/${environment}/DATABASE_URL" \
#     --value "postgresql://..." \
#     --type SecureString \
#     --overwrite
# ============================================================

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.app_name}/${var.environment}/DATABASE_URL"
  description = "PostgreSQL connection string for ${var.environment}"
  type        = "SecureString"
  value       = "CHANGE_ME"

  # 外部から手動更新された値を Terraform が上書きしないようにする
  lifecycle {
    ignore_changes = [value]
  }

  tags = local.common_tags
}

# TODO: 追加のシークレットが必要な場合はここに追加する
# 例:
# resource "aws_ssm_parameter" "my_api_key" {
#   name        = "/${var.app_name}/${var.environment}/MY_API_KEY"
#   description = "My external API key for ${var.environment}"
#   type        = "SecureString"
#   value       = "CHANGE_ME"
#   lifecycle { ignore_changes = [value] }
#   tags = local.common_tags
# }
