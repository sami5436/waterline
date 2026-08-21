import { defaultScenario } from "./presets.ts";
import type {
  CapTable,
  ExerciseStrategy,
  Grant,
  GrantType,
  Round,
  Scenario,
  TaxAssumptions,
} from "./types";

/**
 * Coerces arbitrary JSON — a share link payload, a stale localStorage entry —
 * into a Scenario that the engine can safely run. Anything missing, malformed,
 * or out of range falls back to the default rather than throwing, so an old
 * link never renders a broken page.
 */
export function normalizeScenario(input: unknown): Scenario {
  const raw = isRecord(input) ? input : {};
  return {
    capTable: normalizeCapTable(raw.capTable),
    grant: normalizeGrant(raw.grant),
    tax: normalizeTax(raw.tax),
    maxExit: num(raw.maxExit, defaultScenario.maxExit, 1e5, 1e13),
  };
}

const MAX_ROUNDS = 12;
const MAX_SHARES = 1e12;
const MAX_DOLLARS = 1e13;

function normalizeCapTable(input: unknown): CapTable {
  const raw = isRecord(input) ? input : {};
  const rounds = Array.isArray(raw.rounds) ? raw.rounds.slice(0, MAX_ROUNDS) : [];

  return {
    companyName: str(raw.companyName, defaultScenario.capTable.companyName, 60),
    commonShares: num(raw.commonShares, defaultScenario.capTable.commonShares, 0, MAX_SHARES),
    optionPoolShares: num(raw.optionPoolShares, 0, 0, MAX_SHARES),
    rounds: rounds.map((r, i) => normalizeRound(r, i)),
  };
}

function normalizeRound(input: unknown, index: number): Round {
  const raw = isRecord(input) ? input : {};
  const cap = raw.participationCap;

  return {
    id: str(raw.id, `round-${index}`, 40),
    name: str(raw.name, `Round ${index + 1}`, 40),
    invested: num(raw.invested, 0, 0, MAX_DOLLARS),
    shares: num(raw.shares, 0, 0, MAX_SHARES),
    prefMultiple: num(raw.prefMultiple, 1, 0, 10),
    participating: raw.participating === true,
    participationCap:
      cap === null || cap === undefined ? null : num(cap, 1, 0, 100),
    seniority: Math.round(num(raw.seniority, index, 0, MAX_ROUNDS)),
    projected: raw.projected === true,
  };
}

const GRANT_TYPES: GrantType[] = ["ISO", "NSO", "RSU"];

function normalizeGrant(input: unknown): Grant {
  const raw = isRecord(input) ? input : {};
  const fallback = defaultScenario.grant;

  return {
    shares: num(raw.shares, fallback.shares, 0, MAX_SHARES),
    strike: num(raw.strike, fallback.strike, 0, 1e6),
    type: oneOf(raw.type, GRANT_TYPES, fallback.type),
    grantDate: date(raw.grantDate, fallback.grantDate),
    vestMonths: Math.round(num(raw.vestMonths, fallback.vestMonths, 0, 240)),
    cliffMonths: Math.round(num(raw.cliffMonths, fallback.cliffMonths, 0, 240)),
    asOf: date(raw.asOf, fallback.asOf),
    extraDilution: num(raw.extraDilution, 0, 0, 0.99),
  };
}

const STRATEGIES: ExerciseStrategy[] = ["exercise-at-exit", "early-exercise"];

function normalizeTax(input: unknown): TaxAssumptions {
  const raw = isRecord(input) ? input : {};
  const fallback = defaultScenario.tax;

  return {
    ordinaryRate: num(raw.ordinaryRate, fallback.ordinaryRate, 0, 0.95),
    capitalGainsRate: num(raw.capitalGainsRate, fallback.capitalGainsRate, 0, 0.95),
    amtRate: num(raw.amtRate, fallback.amtRate, 0, 0.95),
    strategy: oneOf(raw.strategy, STRATEGIES, fallback.strategy),
    currentFmv: num(raw.currentFmv, fallback.currentFmv, 0, 1e6),
  };
}

/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed === "" ? fallback : trimmed;
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function date(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? fallback : value;
}
