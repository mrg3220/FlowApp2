/**
 * Centralized configuration — loaded once, validated via Zod, and frozen.
 *
 * Best-practice 2026:
 *  • Validate env vars at startup, fail fast on misconfiguration.
 *  • Use Object.freeze to prevent accidental mutation.
 *  • Keep this the ONLY place that reads process.env.
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  AWS_REGION:          z.string().min(1).default('us-east-1'),
  AWS_ENDPOINT_URL:    z.string().url().optional(),
  DYNAMODB_TABLE_NAME: z.string().min(1).default('flowapp-wing-chun'),
  DYNAMODB_GSI1_NAME:  z.string().min(1).default('GSI1'),
  ORGANIZATION_ID:     z.string().min(1).default('org_default_001'),
  LOG_LEVEL:           z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

/** @type {Readonly<z.infer<typeof envSchema>>} */
export const config = Object.freeze(parsed.data);
