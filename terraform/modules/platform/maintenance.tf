# ============================================================
# 定期バッチ (EventBridge Scheduler)
#
# TODO: 定期実行が必要な場合はここに追加する。
#       不要な場合はこのファイルごと削除してよい。
#
# 追加手順:
#   1. api.tf の locals.functions にバッチ用 Lambda を追加する
#   2. ここに EventBridge ルールとターゲットを追加する
#
# 例: 毎日 03:00 JST（18:00 UTC）に実行するバッチ
# ============================================================

# resource "aws_cloudwatch_event_rule" "daily_batch" {
#   name                = "${local.name_prefix}-daily-batch"
#   description         = "Daily batch job"
#   schedule_expression = "cron(0 18 * * ? *)"
#   tags                = local.common_tags
# }

# resource "aws_cloudwatch_event_target" "daily_batch" {
#   rule      = aws_cloudwatch_event_rule.daily_batch.name
#   target_id = "daily-batch"
#   arn       = aws_lambda_function.this["batch_daily"].arn
# }

# resource "aws_lambda_permission" "allow_daily_batch_schedule" {
#   statement_id  = "AllowExecutionFromEventBridgeDailyBatch"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.this["batch_daily"].function_name
#   principal     = "events.amazonaws.com"
#   source_arn    = aws_cloudwatch_event_rule.daily_batch.arn
# }
