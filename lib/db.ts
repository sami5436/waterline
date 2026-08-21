import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Lazily resolved so a missing DATABASE_URL degrades to "sharing is off"
 * rather than crashing the whole page at import time. Waterline is fully
 * usable without a database — the share link is the only feature that needs
 * one.
 */
type Client = NeonQueryFunction<false, false>;

let cached: Client | null = null;

export function sql(): Client | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) cached = neon(url);
  return cached;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
