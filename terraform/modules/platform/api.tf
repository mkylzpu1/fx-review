# ============================================================
# Lambda 関数 + API Gateway (HTTP API)
#
# ─── 新しい Lambda を追加する方法 ───────────────────────────
# 1. locals.functions に関数定義を追加する
#    例:
#      items_list = {
#        handler = "handlers/items/index.listHandler"
#        timeout = 10
#      }
#
# 2. locals.routes にルート定義を追加する
#    例:
#      items_list = {
#        function_key       = "items_list"
#        route_key          = "GET /items"
#        authorization_type = "JWT"
#      }
#
# 3. sam/template.yaml にも同じ関数を追加する（ローカル開発用）
# 4. backend/build.mjs の handlers 配列にエントリーポイントを追加する
# ============================================================

locals {
  functions = {
    # ─── 認証（変更不要） ────────────────────────────────────
    auth_me = {
      handler = "handlers/auth/me.handler"
      timeout = 10
    }
    auth_withdrawal = {
      handler = "handlers/auth/withdrawal.handler"
      timeout = 10
    }
    auth_registration_status = {
      handler = "handlers/auth/registrationStatus.handler"
      timeout = 10
    }

    # ─── TODO: 機能 Lambda をここに追加する ──────────────────
    # example_list = {
    #   handler = "handlers/example/index.listHandler"
    #   timeout = 10
    # }
    # example_create = {
    #   handler = "handlers/example/index.createHandler"
    #   timeout = 10
    # }
  }

  # ルート定義: 認証不要ルートは authorization_type = "NONE" を明示する
  routes = {
    auth_me = {
      function_key       = "auth_me"
      route_key          = "GET /auth/me"
      authorization_type = "JWT"
    }
    auth_withdrawal = {
      function_key       = "auth_withdrawal"
      route_key          = "DELETE /auth/me"
      authorization_type = "JWT"
    }
    auth_registration_status = {
      function_key       = "auth_registration_status"
      route_key          = "GET /auth/registration-status"
      authorization_type = "NONE"
    }

    # ─── TODO: 機能ルートをここに追加する ────────────────────
    # example_list = {
    #   function_key       = "example_list"
    #   route_key          = "GET /example"
    #   authorization_type = "JWT"
    # }
  }
}

# ─── Lambda デプロイパッケージ ────────────────────────────
# terraform apply 前に CI/CD 側で esbuild によるバンドルを実施しておくこと。
# バンドル済みファイルを build/ ディレクトリに配置する運用を想定する。

# ─── Lambda 関数 ─────────────────────────────────────────

resource "aws_lambda_function" "this" {
  for_each = local.functions

  function_name = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.lambda_role.arn
  runtime       = var.lambda_runtime
  handler       = each.value.handler
  timeout       = each.value.timeout
  memory_size   = var.lambda_memory_size

  filename         = "${path.module}/build/dummy.zip"
  source_code_hash = filebase64sha256("${path.module}/build/dummy.zip")

  architectures = ["arm64"]

  environment {
    variables = local.lambda_common_env
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags       = local.common_tags
  depends_on = [aws_cloudwatch_log_group.lambda]
}

# ─── API Gateway 本体 ─────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [local.frontend_base_url]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }

  tags = local.common_tags
}

# ─── Cognito JWT Authorizer ───────────────────────────────

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  name             = "${local.name_prefix}-cognito-jwt"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

# ─── API Gateway Stage ────────────────────────────────────

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    logging_level            = "INFO"
    throttling_burst_limit   = 50
    throttling_rate_limit    = 50
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      ip                      = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  tags = local.common_tags
}

# ─── API Gateway 統合 ─────────────────────────────────────

resource "aws_apigatewayv2_integration" "this" {
  for_each = local.functions

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this[each.key].invoke_arn
  payload_format_version = "2.0"
}

# ─── ルート ───────────────────────────────────────────────

resource "aws_apigatewayv2_route" "this" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.this[each.value.function_key].id}"

  authorization_type = each.value.authorization_type
  authorizer_id      = each.value.authorization_type == "JWT" ? aws_apigatewayv2_authorizer.cognito.id : null
}

# ─── Lambda 実行権限 ──────────────────────────────────────

resource "aws_lambda_permission" "allow_api" {
  for_each = local.functions

  statement_id  = "AllowExecutionFromApiGateway-${replace(each.key, "_", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
