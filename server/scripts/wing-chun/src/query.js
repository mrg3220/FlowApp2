/**
 * query.js — High-level query helpers built on the single-table
 * key design. Each function returns plain JS objects (no DynamoDB
 * wire format), thanks to the DocumentClient.
 *
 * Usage:  node --env-file=.env src/query.js [command]
 *   or:  npm run query -- <command>
 */

import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, GSI1_NAME } from './dynamodb.js';
import { keys, ORG_ID, PROG_ID }     from './keys.js';
import { BELTS }                      from './data.js';
import { logger }                     from './logger.js';

// ── Queries ──────────────────────────────────────────────

/** Retrieve the program record. */
export async function getProgram(orgId = ORG_ID, progId = PROG_ID) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: keys.program(orgId, progId).PK, SK: keys.program(orgId, progId).SK },
  }));
  return Item ?? null;
}

/** List all belts for a program, ordered by level. */
export async function getAllBelts(progId = PROG_ID) {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': `PROG#${progId}`, ':prefix': 'BELT#' },
  }));
  return Items.sort((a, b) => a.level - b.level);
}

/** Get a single belt by level. */
export async function getBelt(level, progId = PROG_ID) {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: keys.belt(progId, level),
  }));
  return Item ?? null;
}

/** Get requirements for a specific belt level, optionally filtered by age. */
export async function getRequirements(level, ageCategory, progId = PROG_ID) {
  const pk = `PROG#${progId}#BELT#${String(level).padStart(2, '0')}`;
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: ageCategory
      ? 'PK = :pk AND SK = :sk'
      : 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: ageCategory
      ? { ':pk': pk, ':sk': `REQ#${ageCategory}` }
      : { ':pk': pk, ':prefix': 'REQ#' },
  };

  const { Items = [] } = await ddb.send(new QueryCommand(params));
  return ageCategory ? Items[0] ?? null : Items;
}

/** List all curriculum items, optionally filtered by category or minLevel. */
export async function getCurriculum(progId = PROG_ID, { category, maxLevel } = {}) {
  let kce = 'PK = :pk AND begins_with(SK, :prefix)';
  const eav = { ':pk': `PROG#${progId}`, ':prefix': 'CURR#' };

  if (category) {
    kce = 'PK = :pk AND begins_with(SK, :catPrefix)';
    eav[':catPrefix'] = `CURR#${category}#`;
    delete eav[':prefix'];
  }

  const params = { TableName: TABLE_NAME, KeyConditionExpression: kce, ExpressionAttributeValues: eav };

  if (maxLevel !== undefined) {
    params.FilterExpression = 'minimumLevel <= :ml';
    params.ExpressionAttributeValues[':ml'] = maxLevel;
  }

  const { Items = [] } = await ddb.send(new QueryCommand(params));
  return Items;
}

/** Query GSI1 — all entities for a given program. */
export async function getAllProgramEntities(progId = PROG_ID) {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `PROG#${progId}` },
  }));
  return Items;
}

/** Compute the fastest path to Black Belt by age category. */
export async function getTimeToBlackBelt(ageCategory, progId = PROG_ID) {
  const belts = await getAllBelts(progId);
  let totalMonths = 0;

  for (const belt of belts) {
    const req = await getRequirements(belt.level, ageCategory, progId);
    totalMonths += req?.timeInRankMonths ?? belt.monthsMinimum ?? 0;
  }

  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { ageCategory, totalMonths, years, months, display: `${years}y ${months}m` };
}

// ── CLI ──────────────────────────────────────────────────

const COMMANDS = {
  program:     () => getProgram(),
  belts:       () => getAllBelts(),
  belt:        (args) => getBelt(Number(args[0] ?? 1)),
  requirements:(args) => getRequirements(Number(args[0] ?? 1), args[1]),
  curriculum:  (args) => getCurriculum(PROG_ID, { category: args[0] }),
  entities:    () => getAllProgramEntities(),
  'time-to-black': (args) => getTimeToBlackBelt(args[0] ?? 'Adult'),
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || !COMMANDS[cmd]) {
    console.log('Available commands:', Object.keys(COMMANDS).join(', '));
    console.log('Usage: node src/query.js <command> [args...]');
    console.log('');
    console.log('  program                 — Show program record');
    console.log('  belts                   — List all belts');
    console.log('  belt <level>            — Show a single belt');
    console.log('  requirements <level> [age] — Requirements for a level');
    console.log('  curriculum [category]   — List curriculum items');
    console.log('  entities                — All items via GSI1');
    console.log('  time-to-black [age]     — Fastest path to Black Belt');
    return;
  }

  const result = await COMMANDS[cmd](args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  logger.error('Query failed', { error: err.message, stack: err.stack });
  process.exitCode = 1;
});
