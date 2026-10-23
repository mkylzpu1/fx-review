terraform {
  backend "s3" {
    # bootstrap で作成したバケット名を指定する
    bucket         = "YOUR_APP_NAME-terraform-state"
    key            = "YOUR_APP_NAME/stg/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "YOUR_APP_NAME-terraform-lock"
    encrypt        = true
  }
}
