/**
 * seed.js — Populate the single-table DynamoDB table with
 * Wing Chun program data using BatchWriteItem (SDK v3).
 *
 * Usage:  node --env-file=.env src/seed.js
 *   or:  npm run seed
 */

import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME }   from './dynamodb.js';
import { keys, ORG_ID, PROG_ID } from './keys.js';
import { BELTS, REQUIREMENTS, CURRICULUM, AGE_CATEGORIES } from './data.js';
import { logger } from './logger.js';

// ── Constants ────────────────────────────────────────────
const BATCH_SIZE          = 25;   // DynamoDB max per BatchWrite
const MAX_RETRIES         = 5;
const BASE_BACKOFF_MS     = 200;

// ── Helpers ──────────────────────────────────────────────

/** Chunk an array into sub-arrays of `size`. */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Exponential back-off with jitter. */
function backoff(attempt) {
  const delay = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 100;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Write a single batch with automatic retry for UnprocessedItems. */
async function writeBatchWithRetry(items) {
  let unprocessed = items;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: unprocessed.map((item) => ({ PutRequest: { Item: item } })),
      },
    });

    const result = await ddb.send(command);

    const remaining = result.UnprocessedItems?.[TABLE_NAME];
    if (!remaining || remaining.length === 0) return;

    logger.warn('Unprocessed items — retrying', {
      count: remaining.length,
      attempt: attempt + 1,
    });
    unprocessed = remaining.map((r) => r.PutRequest.Item);
    await backoff(attempt);
  }

  throw new Error(`Failed to write all items after ${MAX_RETRIES} retries`);
}

// ── Item Builders ────────────────────────────────────────

function buildProgramItem() {
  return {
    ...keys.program(ORG_ID, PROG_ID),
    entityType:  'Program',
    programId:   PROG_ID,
    orgId:       ORG_ID,
    name:        'Shaolin Wing Chun',
    style:       'Wing Chun Kung Fu',
    lineage:     'Ip Man > Shaolin Heritage',
    totalLevels: BELTS.length,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
}

function buildBeltItems() {
  return BELTS.map((belt) => ({
    ...keys.belt(PROG_ID, belt.level),
    entityType:     'Belt',
    programId:      PROG_ID,
    level:          belt.level,
    code:           belt.code,
    name:           belt.name,
    color:          belt.color,
    description:    belt.desc,
    monthsMinimum:  belt.monthsMin,
    monthsMaximum:  belt.monthsMax,
    createdAt:      new Date().toISOString(),
  }));
}

function buildRequirementItems() {
  const items = [];

  for (const [levelStr, req] of Object.entries(REQUIREMENTS)) {
    const level = Number(levelStr);

    for (const age of AGE_CATEGORIES) {
      items.push({
        ...keys.requirement(PROG_ID, level, age),
        entityType:       'Requirement',
        programId:        PROG_ID,
        level,
        ageCategory:      age,
        techniques:       req.techniques,
        attendance:       req.attendance[age],
        timeInRankMonths: req.timeInRank[age],
        teachingHours:    req.teachingHours[age],
        sparringRequired: req.sparring,
        sparringMinutes:  req.sparringMin[age],
        weaponsRequired:  req.weapons,
        weaponsSkill:     req.weaponsSkill || undefined,
        tournamentWins:   req.tournament,
        curriculumDev:    req.curriculumDev,
        essayRequired:    req.essay,
        essayPrompt:      req.essayPrompt[age],
        createdAt:        new Date().toISOString(),
      });
    }
  }

  return items;
}

function buildCurriculumItems() {
  return CURRICULUM.map((item) => ({
    ...keys.curriculum(PROG_ID, item.category, item.id),
    entityType:        'Curriculum',
    programId:         PROG_ID,
    curriculumId:      item.id,
    name:              item.name,
    category:          item.category,
    technique:         item.technique,
    difficulty:        item.difficulty,
    minimumLevel:      item.minLevel,
    applicableAges:    item.ages,
    description:       item.desc,
    durationMinutes:   item.durationMin ?? undefined,
    createdAt:         new Date().toISOString(),
  }));
}

// ── Main ─────────────────────────────────────────────────

async function seed() {
  logger.info('Starting seed', { table: TABLE_NAME, program: PROG_ID });

  const allItems = [
    buildProgramItem(),
    ...buildBeltItems(),
    ...buildRequirementItems(),
    ...buildCurriculumItems(),
  ];

  logger.info('Items prepared', { total: allItems.length });

  const batches = chunk(allItems, BATCH_SIZE);
  let written = 0;

  for (const [idx, batch] of batches.entries()) {
    await writeBatchWithRetry(batch);
    written += batch.length;
    logger.debug('Batch written', { batch: idx + 1, of: batches.length, written });
  }

  logger.info('Seed complete', { itemsWritten: written });
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message, stack: err.stack });
  process.exitCode = 1;
});
