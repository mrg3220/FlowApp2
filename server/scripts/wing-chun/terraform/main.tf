##############################################################################
# Terraform — FlowApp Wing Chun DynamoDB (Single-Table Design)
#
# Best practices applied:
#   • PAY_PER_REQUEST (on-demand) — no capacity planning required
#   • Point-in-time recovery enabled
#   • Server-side encryption (AWS-managed key by default)
#   • TTL attribute pre-configured (usable but not required)
#   • Deletion protection for production
#   • Tags for cost allocation and ownership
##############################################################################

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  # ── Remote State (uncomment for production) ──────────
  # backend "s3" {
  #   bucket         = "flowapp-terraform-state"
  #   key            = "wing-chun/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "flowapp-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FlowApp"
      Module      = "WingChun"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# ══════════════════════════════════════════════════════════
#  DynamoDB Table — Single-Table Design
# ══════════════════════════════════════════════════════════

resource "aws_dynamodb_table" "wing_chun" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  # Partition + Sort key
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 — cross-entity queries by program
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = var.gsi1_name
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # ── Operational Settings ─────────────────────────────
  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
    # For AWS-managed key, omit kms_key_arn.
    # For CMK encryption, set: kms_key_arn = var.kms_key_arn
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  deletion_protection_enabled = var.deletion_protection

  table_class = "STANDARD"

  tags = {
    Name = var.table_name
  }

  lifecycle {
    prevent_destroy = false   # flip to true in production
  }
}

# ══════════════════════════════════════════════════════════
#  Optional: DynamoDB Auto-Scaling (provisioned mode)
#
#  Uncomment the block below if you later switch from
#  PAY_PER_REQUEST to PROVISIONED for cost optimisation.
# ══════════════════════════════════════════════════════════

# resource "aws_appautoscaling_target" "read" {
#   max_capacity       = 100
#   min_capacity       = 5
#   resource_id        = "table/${aws_dynamodb_table.wing_chun.name}"
#   scalable_dimension = "dynamodb:table:ReadCapacityUnits"
#   service_namespace  = "dynamodb"
# }
#
# resource "aws_appautoscaling_policy" "read" {
#   name               = "${var.table_name}-read-scaling"
#   policy_type        = "TargetTrackingScaling"
#   resource_id        = aws_appautoscaling_target.read.resource_id
#   scalable_dimension = aws_appautoscaling_target.read.scalable_dimension
#   service_namespace  = aws_appautoscaling_target.read.service_namespace
#
#   target_tracking_scaling_policy_configuration {
#     target_value = 70.0
#     predefined_metric_specification {
#       predefined_metric_type = "DynamoDBReadCapacityUtilization"
#     }
#   }
# }
