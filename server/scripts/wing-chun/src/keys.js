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

const ORG_ID = config.ORGANIZATION_ID;
const PROG_ID = 'shaolin_wing_chun';

// ───────────────────── Key Factories ─────────────────────

export const keys = {
  program: () => ({
    PK:     `ORG#${ORG_ID}`,
    SK:     `PROG#${PROG_ID}`,
    GSI1PK: `PROG#${PROG_ID}`,
    GSI1SK: '#META',
  }),

  belt: (level) => ({
    PK:     `PROG#${PROG_ID}`,
    SK:     `BELT#${String(level).padStart(2, '0')}`,
    GSI1PK: `PROG#${PROG_ID}`,
    GSI1SK: `BELT#${String(level).padStart(2, '0')}`,
  }),

  requirement: (level, ageCategory) => ({
    PK:     `PROG#${PROG_ID}#BELT#${String(level).padStart(2, '0')}`,
    SK:     `REQ#${ageCategory}`,
    GSI1PK: `PROG#${PROG_ID}`,
    GSI1SK: `REQ#${ageCategory}#${String(level).padStart(2, '0')}`,
  }),

  curriculum: (category, id, minBeltLevel) => ({
    PK:     `PROG#${PROG_ID}`,
    SK:     `CURR#${category}#${id}`,
    GSI1PK: `PROG#${PROG_ID}`,
    GSI1SK: `CURR#${String(minBeltLevel).padStart(2, '0')}#${id}`,
  }),
};

export { ORG_ID, PROG_ID };
