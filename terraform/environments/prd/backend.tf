terraform {
  backend "s3" {
    bucket         = "YOUR_APP_NAME-terraform-state"
    key            = "YOUR_APP_NAME/prd/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "YOUR_APP_NAME-terraform-lock"
    encrypt        = true
  }
}
