import type {
  CapTable,
  EmployeeOutcome,
  Grant,
  Round,
  Scenario,
  SeriesPayout,
  TaxAssumptions,
  Verdict,
  WaterfallResult,
} from "./types";

const EPS = 1e-6;

/* ------------------------------------------------------------------ */
/* Cap table basics                                                    */
/* ------------------------------------------------------------------ */

export function fullyDilutedShares(ct: CapTable): number {
  return (
    ct.commonShares +
    ct.optionPoolShares +
    ct.rounds.reduce((sum, r) => sum + r.shares, 0)
  );
}

/** Total liquidation preference sitting ahead of common stock. */
export function preferenceOverhang(ct: CapTable): number {
  return ct.rounds.reduce((sum, r) => sum + r.invested * r.prefMultiple, 0);
}

/** Price per share of the most recent (highest seniority number) round. */
export function lastPreferredPrice(ct: CapTable): number {
  const latest = latestRound(ct);
  if (!latest || latest.shares <= 0) return 0;
  return latest.invested / latest.shares;
}

/**
 * The round whose price a recruiter would quote. Rounds are held in
 * chronological order, so that is the last one that has actually closed —
 * projected rounds do not set a headline price.
 */
function latestRound(ct: CapTable): Round | null {
  if (ct.rounds.length === 0) return null;
  for (let i = ct.rounds.length - 1; i >= 0; i--) {
    if (!ct.rounds[i].projected) return ct.rounds[i];
  }
  return ct.rounds[ct.rounds.length - 1];
}

/* ------------------------------------------------------------------ */
/* Residual distribution, with participation caps                      */
/* ------------------------------------------------------------------ */

interface Participant {
  key: string;
  shares: number;
  /** Dollars this participant may still receive before its cap binds. */
  headroom: number;
}

/**
 * Splits `pot` across participants pro-rata by shares, honouring per-participant
 * caps. Anyone who caps out is paid their headroom and removed, which raises the
 * per-share rate for everyone left. Repeats until no cap binds.
 *
 * Returns the dollars each participant receives plus the final uncapped
 * per-share rate — the price per share of common stock.
 */
function distributeResidual(
  pot: number,
  participants: Participant[],
): { payouts: Map<string, number>; rate: number } {
  const payouts = new Map<string, number>();
  for (const p of participants) payouts.set(p.key, 0);

  let active = participants.filter((p) => p.shares > 0 && p.headroom > EPS);
  let remaining = pot;
  let rate = 0;

  // Each pass either finishes or removes at least one participant.
  for (let guard = 0; guard <= participants.length && active.length > 0; guard++) {
    const totalShares = active.reduce((s, p) => s + p.shares, 0);
    if (totalShares <= 0 || remaining <= EPS) break;

    rate = remaining / totalShares;

    const binding = active.filter((p) => p.headroom < p.shares * rate - EPS);
    if (binding.length === 0) {
      for (const p of active) {
        payouts.set(p.key, (payouts.get(p.key) ?? 0) + p.shares * rate);
      }
      remaining = 0;
      break;
    }

    for (const p of binding) {
      payouts.set(p.key, (payouts.get(p.key) ?? 0) + p.headroom);
      remaining -= p.headroom;
    }
    const bindingKeys = new Set(binding.map((p) => p.key));
    active = active.filter((p) => !bindingKeys.has(p.key));
  }

  return { payouts, rate };
}

/* ------------------------------------------------------------------ */
/* Waterfall for a fixed set of conversion decisions                   */
/* ------------------------------------------------------------------ */

const COMMON_KEY = "__common__";

/**
 * Runs the waterfall assuming exactly the rounds in `converting` gave up their
 * liquidation preference and converted to common. Callers are responsible for
 * supplying a set that is actually self-consistent; `runWaterfall` finds it.
 */
export function evaluateWaterfall(
  ct: CapTable,
  exitValue: number,
  converting: ReadonlySet<string>,
): WaterfallResult {
  const exit = Math.max(0, exitValue);
  const fd = fullyDilutedShares(ct);
  const commonShares = ct.commonShares + ct.optionPoolShares;

  /* Step 1 — pay liquidation preferences in seniority tiers. */
  const unconverted = ct.rounds.filter((r) => !converting.has(r.id));
  const tiers = [...new Set(unconverted.map((r) => r.seniority))].sort(
    (a, b) => a - b,
  );

  const prefPaid = new Map<string, number>();
  for (const r of ct.rounds) prefPaid.set(r.id, 0);

  let pot = exit;
  let totalPreferencePaid = 0;

  for (const tier of tiers) {
    const inTier = unconverted.filter((r) => r.seniority === tier);
    const demand = inTier.reduce((s, r) => s + r.invested * r.prefMultiple, 0);
    if (demand <= 0) continue;

    if (pot >= demand - EPS) {
      for (const r of inTier) prefPaid.set(r.id, r.invested * r.prefMultiple);
      pot -= demand;
      totalPreferencePaid += demand;
    } else {
      // Not enough left: everyone in the tier pro-rates by claim size and
      // every junior tier gets nothing.
      for (const r of inTier) {
        const claim = r.invested * r.prefMultiple;
        prefPaid.set(r.id, pot * (claim / demand));
      }
      totalPreferencePaid += pot;
      pot = 0;
      break;
    }
  }

  /* Step 2 — split the residual across everyone entitled to it. */
  const participants: Participant[] = [];
  if (commonShares > 0) {
    participants.push({ key: COMMON_KEY, shares: commonShares, headroom: Infinity });
  }
  for (const r of ct.rounds) {
    if (converting.has(r.id)) {
      // Converted preferred is just common now: no preference, no cap.
      participants.push({ key: r.id, shares: r.shares, headroom: Infinity });
    } else if (r.participating) {
      const headroom =
        r.participationCap === null
          ? Infinity
          : Math.max(0, r.participationCap * r.invested - (prefPaid.get(r.id) ?? 0));
      participants.push({ key: r.id, shares: r.shares, headroom });
    }
    // Non-participating, non-converting preferred is done: preference only.
  }

  const { payouts } = distributeResidual(pot, participants);

  const commonPool = payouts.get(COMMON_KEY) ?? 0;
  const commonPricePerShare = commonShares > 0 ? commonPool / commonShares : 0;

  const series: SeriesPayout[] = ct.rounds.map((r) => {
    const preference = converting.has(r.id) ? 0 : (prefPaid.get(r.id) ?? 0);
    const participation = payouts.get(r.id) ?? 0;
    const total = preference + participation;
    const cappedOut =
      !converting.has(r.id) &&
      r.participating &&
      r.participationCap !== null &&
      total >= r.participationCap * r.invested - EPS;
    return {
      id: r.id,
      name: r.name,
      converted: converting.has(r.id),
      preference,
      participation,
      total,
      multipleOnInvested: r.invested > 0 ? total / r.invested : 0,
      cappedOut,
    };
  });

  return {
    exitValue: exit,
    commonPricePerShare,
    totalPreferencePaid,
    commonPool,
    series,
    fullyDiluted: fd,
  };
}

/* ------------------------------------------------------------------ */
/* Finding the self-consistent conversion set                          */
/* ------------------------------------------------------------------ */

/**
 * Every preferred holder independently picks whichever of "take the preference"
 * or "convert to common" pays it more — but each choice changes the residual,
 * and therefore everyone else's answer. The stable outcome is the set where no
 * single holder can improve by switching: a Nash equilibrium over n binary
 * choices.
 *
 * Best-response iteration lands on it almost immediately for real cap tables.
 * If a structure cycles, we fall back to exhaustive search.
 */
export function runWaterfall(ct: CapTable, exitValue: number): WaterfallResult {
  const rounds = ct.rounds;
  if (rounds.length === 0) return evaluateWaterfall(ct, exitValue, new Set());

  let current = new Set<string>();
  let result = evaluateWaterfall(ct, exitValue, current);

  const maxSweeps = rounds.length * 4 + 8;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let changed = false;
    for (const r of rounds) {
      const flipped = new Set(current);
      if (flipped.has(r.id)) flipped.delete(r.id);
      else flipped.add(r.id);

      const alt = evaluateWaterfall(ct, exitValue, flipped);
      if (payoutOf(alt, r.id) > payoutOf(result, r.id) + EPS) {
        current = flipped;
        result = alt;
        changed = true;
      }
    }
    if (!changed) return result;
  }

  // Best-response cycled. Enumerate exhaustively when that is affordable.
  if (rounds.length <= 16) {
    const exhaustive = searchEquilibrium(ct, exitValue);
    if (exhaustive) return exhaustive;
  }
  return result;
}

function payoutOf(result: WaterfallResult, id: string): number {
  return result.series.find((s) => s.id === id)?.total ?? 0;
}

function searchEquilibrium(
  ct: CapTable,
  exitValue: number,
): WaterfallResult | null {
  const rounds = ct.rounds;
  const n = rounds.length;
  const subsets: number[] = [];
  for (let mask = 0; mask < 1 << n; mask++) subsets.push(mask);
  // Prefer the fewest conversions among equilibria: preferred holders only give
  // up a preference when converting strictly pays better.
  subsets.sort((a, b) => popcount(a) - popcount(b) || a - b);

  for (const mask of subsets) {
    const set = new Set<string>();
    for (let i = 0; i < n; i++) if (mask & (1 << i)) set.add(rounds[i].id);

    const result = evaluateWaterfall(ct, exitValue, set);
    let stable = true;
    for (let i = 0; i < n && stable; i++) {
      const flipped = new Set(set);
      if (flipped.has(rounds[i].id)) flipped.delete(rounds[i].id);
      else flipped.add(rounds[i].id);
      const alt = evaluateWaterfall(ct, exitValue, flipped);
      if (payoutOf(alt, rounds[i].id) > payoutOf(result, rounds[i].id) + EPS) {
        stable = false;
      }
    }
    if (stable) return result;
  }
  return null;
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Vesting                                                             */
/* ------------------------------------------------------------------ */

export function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function vestedShares(grant: Grant): {
  vested: number;
  fraction: number;
  monthsElapsed: number;
} {
  const months = monthsBetween(grant.grantDate, grant.asOf);
  const total = Math.max(0, grant.shares);

  if (grant.vestMonths <= 0) {
    return { vested: total, fraction: 1, monthsElapsed: months };
  }
  if (months < grant.cliffMonths) {
    return { vested: 0, fraction: 0, monthsElapsed: months };
  }
  const fraction = Math.min(1, months / grant.vestMonths);
  return {
    vested: Math.floor(total * fraction),
    fraction,
    monthsElapsed: months,
  };
}

/* ------------------------------------------------------------------ */
/* What the employee actually walks away with                          */
/* ------------------------------------------------------------------ */

export function employeeOutcome(
  scenario: Scenario,
  waterfall: WaterfallResult,
): EmployeeOutcome {
  const { grant, tax } = scenario;
  const { vested, fraction, monthsElapsed } = vestedShares(grant);

  const dilution = clamp(grant.extraDilution, 0, 0.999);
  const effectiveShares = vested * (1 - dilution);

  const pps = waterfall.commonPricePerShare;
  const gross = effectiveShares * pps;
  const exerciseCost = grant.type === "RSU" ? 0 : effectiveShares * grant.strike;
  const spread = Math.max(0, gross - exerciseCost);
  const underwater = pps <= grant.strike + EPS;

  const { taxDue, amtEstimate } = estimateTax(grant, tax, effectiveShares, pps, spread);

  const net = Math.max(0, spread - taxDue);
  const cashRequiredToday =
    tax.strategy === "early-exercise" && grant.type !== "RSU"
      ? effectiveShares * grant.strike + amtEstimate
      : 0;

  return {
    vested,
    effectiveShares,
    vestedFraction: fraction,
    monthsElapsed,
    ownershipFraction:
      waterfall.fullyDiluted > 0 ? effectiveShares / waterfall.fullyDiluted : 0,
    commonPricePerShare: pps,
    gross,
    exerciseCost,
    spread,
    tax: taxDue,
    net,
    cashRequiredToday,
    amtEstimate,
    underwater,
  };
}

function estimateTax(
  grant: Grant,
  tax: TaxAssumptions,
  shares: number,
  pps: number,
  spread: number,
): { taxDue: number; amtEstimate: number } {
  if (spread <= 0) return { taxDue: 0, amtEstimate: 0 };

  if (grant.type === "RSU") {
    // RSUs settle as ordinary income on the full value at vest/exit.
    return { taxDue: spread * tax.ordinaryRate, amtEstimate: 0 };
  }

  if (tax.strategy === "early-exercise") {
    // Exercised while the 409A was low, held long enough for long-term rates.
    // ISOs generate AMT on the bargain element in the year of exercise; NSOs
    // generate ordinary income on it instead.
    const bargainElement = Math.max(0, shares * (tax.currentFmv - grant.strike));
    if (grant.type === "ISO") {
      return {
        taxDue: spread * tax.capitalGainsRate,
        amtEstimate: bargainElement * tax.amtRate,
      };
    }
    return {
      taxDue: spread * tax.capitalGainsRate,
      // NSO spread at exercise is ordinary income, due the same year.
      amtEstimate: bargainElement * tax.ordinaryRate,
    };
  }

  // Cashless exercise at the exit. An ISO exercised and sold the same day is a
  // disqualifying disposition, so the whole spread is ordinary income — same as
  // an NSO.
  void pps;
  return { taxDue: spread * tax.ordinaryRate, amtEstimate: 0 };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/* ------------------------------------------------------------------ */
/* Thresholds: the waterline itself                                    */
/* ------------------------------------------------------------------ */

function netAtExit(scenario: Scenario, exit: number): number {
  return employeeOutcome(scenario, runWaterfall(scenario.capTable, exit)).net;
}

function commonPoolAtExit(scenario: Scenario, exit: number): number {
  return runWaterfall(scenario.capTable, exit).commonPool;
}

/**
 * Bisects for the lowest exit value at which `probe` turns positive. Returns
 * null when no exit inside the search range clears it.
 */
function findThreshold(
  probe: (exit: number) => number,
  ceiling: number,
): number | null {
  if (probe(0) > EPS) return 0;

  let hi = Math.max(1e6, ceiling);
  let found = false;
  for (let i = 0; i < 40; i++) {
    if (probe(hi) > EPS) {
      found = true;
      break;
    }
    hi *= 2;
    if (hi > 1e15) break;
  }
  if (!found) return null;

  let lo = 0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (probe(mid) > EPS) hi = mid;
    else lo = mid;
    if (hi - lo < Math.max(1, hi * 1e-9)) break;
  }
  return hi;
}

export function computeVerdict(scenario: Scenario): Verdict {
  const ct = scenario.capTable;
  const overhang = preferenceOverhang(ct);
  const ceiling = Math.max(overhang * 4, scenario.maxExit, 1e8);

  const waterline = findThreshold((e) => netAtExit(scenario, e), ceiling);
  const commonBreakeven = findThreshold((e) => commonPoolAtExit(scenario, e), ceiling);

  const price = lastPreferredPrice(ct);
  const fd = fullyDilutedShares(ct);

  return {
    waterline,
    preferenceOverhang: overhang,
    commonBreakeven,
    headlineValue: scenario.grant.shares * price,
    lastPreferredPrice: price,
    lastPostMoney: price * fd,
  };
}

/* ------------------------------------------------------------------ */
/* Curve sampling for the chart                                        */
/* ------------------------------------------------------------------ */

export interface CurvePoint {
  exit: number;
  net: number;
  gross: number;
  pricePerShare: number;
  commonPool: number;
}

/**
 * Samples the payout curve across [0, maxExit]. Threshold values are injected
 * as extra samples so the kinks where preferences convert stay sharp instead of
 * being rounded off by the sampling grid.
 */
export function sampleCurve(
  scenario: Scenario,
  steps = 160,
  extraStops: number[] = [],
): CurvePoint[] {
  const max = Math.max(1, scenario.maxExit);
  const xs = new Set<number>();
  for (let i = 0; i <= steps; i++) xs.add((max * i) / steps);
  for (const stop of extraStops) {
    if (stop > 0 && stop <= max) {
      xs.add(stop);
      xs.add(Math.max(0, stop - max / (steps * 40)));
      xs.add(Math.min(max, stop + max / (steps * 40)));
    }
  }

  return [...xs]
    .sort((a, b) => a - b)
    .map((exit) => {
      const wf = runWaterfall(scenario.capTable, exit);
      const out = employeeOutcome(scenario, wf);
      return {
        exit,
        net: out.net,
        gross: out.gross,
        pricePerShare: wf.commonPricePerShare,
        commonPool: wf.commonPool,
      };
    });
}
