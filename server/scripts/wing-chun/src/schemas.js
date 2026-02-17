/**
 * schemas.js — Zod validation schemas for all Wing Chun entities.
 *
 * Following FlowApp convention: schemas.py → schemas.js
 * Separates validation concerns from data.
 */

import { z } from 'zod';
import { AGE_CATEGORIES } from './data.js';

// ── Helpers ──────────────────────────────────────────────

const ageCatEnum = z.enum(AGE_CATEGORIES);

const ageMap = (valSchema) =>
  z.object(Object.fromEntries(AGE_CATEGORIES.map((a) => [a, valSchema])));

// ── Entity Schemas ───────────────────────────────────────

export const BeltSchema = z.object({
  level:     z.number().int().min(1).max(10),
  name:      z.string().min(1),
  code:      z.string().regex(/^LV\d{1,2}$/),
  color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  desc:      z.string().min(1),
  monthsMin: z.number().int().min(1),
  monthsMax: z.number().int().min(1),
}).refine((b) => b.monthsMax >= b.monthsMin, {
  message: 'monthsMax must be >= monthsMin',
});

export const RequirementSchema = z.object({
  techniques:    z.array(z.string().min(1)).min(1),
  attendance:    ageMap(z.number().int().min(0)),
  timeInRank:    ageMap(z.number().int().min(0)),
  teachingHours: ageMap(z.number().int().min(0)),
  sparring:      z.boolean(),
  sparringMin:   ageMap(z.number().int().min(0)),
  weapons:       z.boolean(),
  weaponsSkill:  z.string(),
  tournament:    z.number().int().min(0),
  curriculumDev: z.boolean(),
  essay:         z.boolean(),
  essayPrompt:   ageMap(z.string().min(1)),
});

export const CurriculumSchema = z.object({
  id:         z.string().min(1),
  name:       z.string().min(1),
  category:   z.string().min(1),
  technique:  z.string().min(1),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  minLevel:   z.number().int().min(1).max(10),
  ages:       z.array(ageCatEnum).min(1),
  desc:       z.string().min(1),
});
