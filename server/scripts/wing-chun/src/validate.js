/**
 * validate.js — Pre-flight data integrity checks.
 *
 * Run before seeding to catch structural problems early.
 *
 * Usage:  node --env-file=.env src/validate.js
 *   or:  npm run validate
 */

import { BELTS, REQUIREMENTS, CURRICULUM } from './data.js';
import { BeltSchema, RequirementSchema, CurriculumSchema } from './schemas.js';
import { logger } from './logger.js';

// ── Validation Runner ────────────────────────────────────

function validate() {
  let errors = 0;

  // Belts
  for (const belt of BELTS) {
    const result = BeltSchema.safeParse(belt);
    if (!result.success) {
      errors++;
      logger.error('Belt validation failed', { belt: belt.code, issues: result.error.issues });
    }
  }

  // Continuous level sequence 1..10
  const levels = BELTS.map((b) => b.level);
  const expected = Array.from({ length: 10 }, (_, i) => i + 1);
  if (JSON.stringify(levels) !== JSON.stringify(expected)) {
    errors++;
    logger.error('Belt levels are not a continuous 1–10 sequence', { levels });
  }

  // Requirements
  for (const [levelStr, req] of Object.entries(REQUIREMENTS)) {
    const result = RequirementSchema.safeParse(req);
    if (!result.success) {
      errors++;
      logger.error('Requirement validation failed', { level: levelStr, issues: result.error.issues });
    }
  }

  // Requirements cover all 10 levels
  const reqLevels = Object.keys(REQUIREMENTS).map(Number).sort((a, b) => a - b);
  if (JSON.stringify(reqLevels) !== JSON.stringify(expected)) {
    errors++;
    logger.error('Requirements do not cover all 10 levels', { present: reqLevels });
  }

  // Curriculum
  const currIds = new Set();
  for (const item of CURRICULUM) {
    const result = CurriculumSchema.safeParse(item);
    if (!result.success) {
      errors++;
      logger.error('Curriculum validation failed', { id: item.id, issues: result.error.issues });
    }
    if (currIds.has(item.id)) {
      errors++;
      logger.error('Duplicate curriculum id', { id: item.id });
    }
    currIds.add(item.id);
  }

  // Summary
  if (errors === 0) {
    logger.info('Validation passed', {
      belts: BELTS.length,
      requirements: Object.keys(REQUIREMENTS).length,
      curriculum: CURRICULUM.length,
    });
  } else {
    logger.error('Validation failed', { errors });
    process.exitCode = 1;
  }
}

validate();
