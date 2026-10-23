# ============================================================
# Cognito User Pool
#
# 仕様:
#   - サインアップ/サインインは Google アカウントのみ許可する。
#   - Cognito ネイティブのユーザー名/パスワード登録は行わせない。
#   - Hosted UI (Cognito ドメイン) 経由の OAuth2 Authorization Code フローを利用する。
# ============================================================

resource "aws_cognito_user_pool" "pool" {
  name = "${local.name_prefix}-user-pool"

  # Google フェデレーションのみ → セルフサインアップ無効化
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  schema {
    name                = "email"
    attribute_data_type = "String"
    mutable             = true
    required            = true
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    mutable             = true
    required            = false
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  lifecycle {
    ignore_changes = [schema]
  }

  tags = local.common_tags
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.pool.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_oauth_client_id
    client_secret    = var.google_oauth_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
    picture  = "picture"
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = local.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.pool.id
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "${local.name_prefix}-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false

  # "COGNITO" を含めないことで Hosted UI 上に Google だけを表示する
  supported_identity_providers = ["Google"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = [
    "${local.frontend_base_url}/callback",
  ]

  logout_urls = [
    "${local.frontend_base_url}/login",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_identity_provider.google]
}
