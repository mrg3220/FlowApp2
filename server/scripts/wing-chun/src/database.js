/**
 * DynamoDB client — AWS SDK v3, singleton pattern.
 *
 * 2026 best practices:
 *  • Use @aws-sdk/lib-dynamodb (Document Client wrapper over v3 base).
 *  • Keep the client a singleton so connections are reused.
 *  • Support local DynamoDB (via AWS_ENDPOINT_URL) for development.
 *  • Explicitly set maxAttempts & requestHandler for observability.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from './config.js';

const baseClient = new DynamoDBClient({
  region: config.AWS_REGION,
  ...(config.AWS_ENDPOINT_URL && { endpoint: config.AWS_ENDPOINT_URL }),
  maxAttempts: 3,
});

/**
 * DynamoDB Document Client with marshalling defaults.
 * removeUndefinedValues prevents accidental attribute creation.
 */
export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAME = config.DYNAMODB_TABLE_NAME;
export const GSI1_NAME = config.DYNAMODB_GSI1_NAME;
