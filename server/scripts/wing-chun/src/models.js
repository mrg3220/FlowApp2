/**
 * Single-Table DynamoDB Key Design for Wing Chun Program
 * ═══════════════════════════════════════════════════════
 *
 * Following the 2026 best-practice "single-table design" pattern
 * recommended by Rick Houlihan and the AWS DynamoDB team.
 *
 * ┌──────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
 * │  Entity                      │  PK                              │  SK                              │  GSI1PK → GSI1SK                 │
 * ├──────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
 * │  Program                     │  ORG#<orgId>                     │  PROG#<progId>                   │  PROG#<progId>  → #META          │
 * │  Belt                        │  PROG#<progId>                   │  BELT#<level>                    │  PROG#<progId>  → BELT#<level>   │
 * │  BeltRequirement             │  PROG#<progId>#BELT#<level>      │  REQ#<ageCategory>               │  PROG#<progId>  → REQ#<age>#<lv> │
 * │  CurriculumItem              │  PROG#<progId>                   │  CURR#<category>#<id>            │  PROG#<progId>  → CURR#<minLv>   │
 * └──────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
 *
 * Access patterns served:
 *  1. Get program by org          →  PK = ORG#<orgId>,  SK begins_with PROG#
 *  2. Get all belts for program   →  PK = PROG#<progId>, SK begins_with BELT#
 *  3. Get reqs for belt + age     →  PK = PROG#<progId>#BELT#<lv>, SK = REQ#<age>
 *  4. Get all reqs for belt       →  PK = PROG#<progId>#BELT#<lv>, SK begins_with REQ#
 *  5. Get curriculum for program  →  PK = PROG#<progId>, SK begins_with CURR#
 *  6. Get curriculum by min level →  GSI1PK = PROG#<progId>, GSI1SK begins_with CURR#<lv>
 *  7. Get everything for program  →  GSI1PK = PROG#<progId>
 */

import { config } from './config.js';

/**
 * models.js — Data model key factories for single-table DynamoDB design.
 *
 * Following FlowApp convention: models.py → models.js
 * Each factory accepts explicit IDs for testability and reuse.
 */

export const ORG_ID  = config.ORGANIZATION_ID;
export const PROG_ID = 'shaolin_wing_chun';

// ───────────────────── Key Factories ─────────────────────

export const keys = {
  /** @param {string} orgId  @param {string} progId */
  program: (orgId, progId) => ({
    PK:     `ORG#${orgId}`,
    SK:     `PROG#${progId}`,
    GSI1PK: `PROG#${progId}`,
    GSI1SK: '#META',
  }),

  /** @param {string} progId  @param {number} level */
  belt: (progId, level) => ({
    PK:     `PROG#${progId}`,
    SK:     `BELT#${String(level).padStart(2, '0')}`,
    GSI1PK: `PROG#${progId}`,
    GSI1SK: `BELT#${String(level).padStart(2, '0')}`,
  }),

  /** @param {string} progId  @param {number} level  @param {string} ageCategory */
  requirement: (progId, level, ageCategory) => ({
    PK:     `PROG#${progId}#BELT#${String(level).padStart(2, '0')}`,
    SK:     `REQ#${ageCategory}`,
    GSI1PK: `PROG#${progId}`,
    GSI1SK: `REQ#${ageCategory}#${String(level).padStart(2, '0')}`,
  }),

  /** @param {string} progId  @param {string} category  @param {string} id */
  curriculum: (progId, category, id) => ({
    PK:     `PROG#${progId}`,
    SK:     `CURR#${category}#${id}`,
    GSI1PK: `PROG#${progId}`,
    GSI1SK: `CURR#${category}#${id}`,
  }),
};
