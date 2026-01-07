import {requireEnv} from '@/lib/env';

export function getFalKey(): string {
  return requireEnv('FAL_KEY');
}

export type FalJobInput = Record<string, unknown>;
export type FalJobOutput = Record<string, unknown>;

// Intentionally minimal for now. We'll add real model calls when we implement generation.
