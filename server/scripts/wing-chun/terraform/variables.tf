##############################################################################
# Variables
##############################################################################

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod"
  }
}

variable "table_name" {
  description = "DynamoDB table name (single-table design)"
  type        = string
  default     = "flowapp-wing-chun"
}

variable "gsi1_name" {
  description = "Global Secondary Index 1 name"
  type        = string
  default     = "GSI1"
}

variable "deletion_protection" {
  description = "Enable DynamoDB deletion protection (recommended for prod)"
  type        = bool
  default     = false
}

# variable "kms_key_arn" {
#   description = "Customer-managed KMS key ARN for SSE (leave blank for AWS-managed key)"
#   type        = string
#   default     = ""
# }
