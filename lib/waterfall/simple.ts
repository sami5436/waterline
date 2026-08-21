import type { Scenario } from "./types";

/**
 * The five numbers someone can actually find without asking their employer for
 * the charter: two from the offer letter, two from a news story or Crunchbase,
 * and a share count that is often on the offer letter too.
 *
 * Simple mode assumes the standard deal — one pool of investor money at a 1x
 * non-participating preference — and full vesting. That is enough to show the
 * effect that surprises people. Detailed mode exists for when the real terms
 * turn out not to be standard, which is the whole point of asking for them.
 */
export interface SimpleInputs {
  options: number;
  strike: number;
  /** The company's most recent post-money valuation. */
  valuation: number;
  /** Everything investors have put in, across all rounds. */
  totalRaised: number;
  fullyDiluted: number;
}

/** A vesting start far enough back that the grant is fully vested. */
const FULLY_VESTED_FROM = "2000-01-01";

export function simpleToScenario(input: SimpleInputs, base: Scenario): Scenario {
  const fullyDiluted = Math.max(1, input.fullyDiluted);
  const pricePerShare = fullyDiluted > 0 ? input.valuation / fullyDiluted : 0;

  // Shares the investors hold for their money, at the price the valuation
  // implies. Capped so a raise larger than the valuation can't drive common
  // negative — a real down-round is a detailed-mode conversation.
  const investorShares =
    pricePerShare > 0
      ? Math.min(input.totalRaised / pricePerShare, fullyDiluted * 0.95)
      : 0;

  return {
    ...base,
    capTable: {
      companyName: base.capTable.companyName,
      commonShares: Math.max(0, fullyDiluted - investorShares),
      optionPoolShares: 0,
      rounds:
        input.totalRaised > 0
          ? [
              {
                id: "investors",
                name: "Investors",
                invested: input.totalRaised,
                shares: investorShares,
                prefMultiple: 1,
                participating: false,
                participationCap: null,
                seniority: 0,
              },
            ]
          : [],
    },
    grant: {
      ...base.grant,
      shares: input.options,
      strike: input.strike,
      grantDate: FULLY_VESTED_FROM,
      extraDilution: 0,
    },
    maxExit: Math.max(input.valuation * 5, input.totalRaised * 4, 10_000_000),
  };
}

/**
 * Reads simple inputs back out of a full scenario, so switching modes carries
 * the numbers across instead of resetting them.
 */
export function scenarioToSimple(scenario: Scenario): SimpleInputs {
  const { capTable, grant } = scenario;
  const fullyDiluted =
    capTable.commonShares +
    capTable.optionPoolShares +
    capTable.rounds.reduce((sum, r) => sum + r.shares, 0);

  const totalRaised = capTable.rounds.reduce((sum, r) => sum + r.invested, 0);

  // Value the company at its last round's price, which is the number people
  // quote — the same one the detailed view calls the post-money.
  const last = [...capTable.rounds].reverse().find((r) => !r.projected);
  const price = last && last.shares > 0 ? last.invested / last.shares : 0;

  return {
    options: grant.shares,
    strike: grant.strike,
    valuation: price * fullyDiluted,
    totalRaised,
    fullyDiluted,
  };
}
