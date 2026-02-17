/**
 * teardown.js — Remove all seeded items from the table.
 *
 * This performs a full scan + batch delete, so use only in
 * development or test environments.
 *
 * Usage:  node --env-file=.env src/teardown.js
 *   or:  npm run teardown
 */

import { ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './dynamodb.js';
import { logger }          from './logger.js';

const BATCH_SIZE      = 25;
const MAX_RETRIES     = 5;
const BASE_BACKOFF_MS = 200;

function backoff(attempt) {
  const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function deleteBatchWithRetry(deleteRequests) {
  let unprocessed = deleteRequests;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { UnprocessedItems } = await ddb.send(
      new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: unprocessed } }),
    );

    const remaining = UnprocessedItems?.[TABLE_NAME];
    if (!remaining || remaining.length === 0) return;

    logger.warn('Unprocessed deletes — retrying', { count: remaining.length, attempt: attempt + 1 });
    unprocessed = remaining;
    await backoff(attempt);
  }

  throw new Error(`Failed to delete all items after ${MAX_RETRIES} retries`);
}

async function teardown() {
  logger.info('Starting teardown', { table: TABLE_NAME });

  let lastKey;
  let totalDeleted = 0;

  do {
    const scan = await ddb.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'PK, SK',
      ExclusiveStartKey: lastKey,
    }));

    const items = scan.Items ?? [];
    lastKey = scan.LastEvaluatedKey;

    if (items.length === 0) break;

    // Build batches of DeleteRequests
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE).map((item) => ({
        DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
      }));
      await deleteBatchWithRetry(batch);
      totalDeleted += batch.length;
      logger.debug('Deleted batch', { deleted: totalDeleted });
    }
  } while (lastKey);

  logger.info('Teardown complete', { itemsDeleted: totalDeleted });
}

teardown().catch((err) => {
  logger.error('Teardown failed', { error: err.message, stack: err.stack });
  process.exitCode = 1;
});
