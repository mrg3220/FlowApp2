##############################################################################
# Outputs
##############################################################################

output "table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.wing_chun.name
}

output "table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.wing_chun.arn
}

output "table_id" {
  description = "DynamoDB table ID"
  value       = aws_dynamodb_table.wing_chun.id
}

output "gsi1_name" {
  description = "GSI1 index name"
  value       = var.gsi1_name
}

output "table_stream_arn" {
  description = "DynamoDB Streams ARN (empty unless streams are enabled)"
  value       = aws_dynamodb_table.wing_chun.stream_arn
}
