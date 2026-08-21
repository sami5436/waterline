import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeVerdict,
  employeeOutcome,
  fullyDilutedShares,
  monthsBetween,
  preferenceOverhang,
  runWaterfall,
  vestedShares,
} from "./engine.ts";
import type { CapTable, Grant, Round, Scenario, TaxAssumptions } from "./types.ts";

const M = 1_000_000;

function round(over: Partial<Round> & Pick<Round, "id" | "invested" | "shares">): Round {
  return {
    name: over.id,
    prefMultiple: 1,
    participating: false,
    participationCap: null,
    seniority: 0,
    ...over,
  };
}

function table(over: Partial<CapTable> = {}): CapTable {
  return {
    companyName: "Test Co",
    commonShares: 10 * M,
    optionPoolShares: 0,
    rounds: [],
    ...over,
  };
}

/** Price per fully diluted common share at a given exit. */
function pps(ct: CapTable, exit: number): number {
  return runWaterfall(ct, exit).commonPricePerShare;
}

function payout(ct: CapTable, exit: number, id: string): number {
  return runWaterfall(ct, exit).series.find((s) => s.id === id)!.total;
}

const near = (a: number, b: number, tol = 1) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

/* ================================================================== */

describe("cap table arithmetic", () => {
  it("counts common, the option pool, and every preferred series", () => {
    const ct = table({
      commonShares: 8 * M,
      optionPoolShares: 2 * M,
      rounds: [round({ id: "A", invested: 5 * M, shares: 5 * M })],
    });
    assert.equal(fullyDilutedShares(ct), 15 * M);
  });

  it("sums the preference stack at its multiple, not the amount invested", () => {
    const ct = table({
      rounds: [
        round({ id: "A", invested: 5 * M, shares: 5 * M, prefMultiple: 1 }),
        round({ id: "B", invested: 10 * M, shares: 5 * M, prefMultiple: 2 }),
      ],
    });
    assert.equal(preferenceOverhang(ct), 25 * M);
  });
});

describe("all-common cap table", () => {
  it("splits the exit evenly across every share", () => {
    const ct = table({ commonShares: 10 * M });
    near(pps(ct, 10 * M), 1);
    near(pps(ct, 0), 0);
  });
});

describe("1x non-participating preferred", () => {
  // $10M in for half the company. Preferred takes the greater of its $10M
  // preference and its 50% as-converted share, so it flips at a $20M exit.
  const ct = table({
    commonShares: 10 * M,
    rounds: [round({ id: "A", invested: 10 * M, shares: 10 * M })],
  });

  it("takes the preference below the indifference point", () => {
    const wf = runWaterfall(ct, 15 * M);
    assert.equal(wf.series[0].converted, false);
    near(wf.series[0].total, 10 * M);
    near(wf.commonPool, 5 * M);
    near(wf.commonPricePerShare, 0.5);
  });

  it("converts to common above the indifference point", () => {
    const wf = runWaterfall(ct, 30 * M);
    assert.equal(wf.series[0].converted, true);
    near(wf.series[0].total, 15 * M);
    near(wf.commonPricePerShare, 1.5);
  });

  it("pays common nothing at or below the preference", () => {
    near(pps(ct, 10 * M), 0);
    near(pps(ct, 6 * M), 0);
    near(payout(ct, 6 * M, "A"), 6 * M);
  });

  it("never pays the preferred less than its preference", () => {
    for (const exit of [11, 14, 18, 20, 22, 40].map((x) => x * M)) {
      assert.ok(payout(ct, exit, "A") >= 10 * M - 1);
    }
  });
});

describe("1x participating preferred", () => {
  // Same money, but it double dips: $10M off the top and then half of the rest.
  const ct = table({
    commonShares: 10 * M,
    rounds: [
      round({ id: "A", invested: 10 * M, shares: 10 * M, participating: true }),
    ],
  });

  it("takes its preference and then shares the residual", () => {
    const wf = runWaterfall(ct, 15 * M);
    near(wf.series[0].preference, 10 * M);
    near(wf.series[0].participation, 2.5 * M);
    near(wf.commonPool, 2.5 * M);
    near(wf.commonPricePerShare, 0.25);
  });

  it("costs common real money relative to non-participating", () => {
    const nonPart = table({
      commonShares: 10 * M,
      rounds: [round({ id: "A", invested: 10 * M, shares: 10 * M })],
    });
    assert.ok(pps(ct, 40 * M) < pps(nonPart, 40 * M));
  });
});

describe("capped participating preferred", () => {
  // 1x participating capped at 2x. Once the cap binds, converting to common is
  // strictly better, so the cap becomes the point where it stops double dipping.
  const ct = table({
    commonShares: 10 * M,
    rounds: [
      round({
        id: "A",
        invested: 10 * M,
        shares: 10 * M,
        participating: true,
        participationCap: 2,
      }),
    ],
  });

  it("double dips freely while the cap still has headroom", () => {
    // $25M exit: $10M preference plus half of the $15M residual is $17.5M,
    // short of the $20M cap, so nothing binds yet.
    const wf = runWaterfall(ct, 25 * M);
    assert.equal(wf.series[0].converted, false);
    near(wf.series[0].total, 17.5 * M);
    assert.equal(wf.series[0].cappedOut, false);
    near(wf.commonPool, 7.5 * M);
  });

  it("stops paying participation once the cap binds", () => {
    // $35M exit: participation would be $12.5M but only $10M of headroom is
    // left under the cap, so the extra falls through to common.
    const wf = runWaterfall(ct, 35 * M);
    assert.equal(wf.series[0].converted, false);
    near(wf.series[0].total, 20 * M);
    assert.equal(wf.series[0].cappedOut, true);
    near(wf.commonPool, 15 * M);
    near(wf.commonPricePerShare, 1.5);
  });

  it("redirects everything above the cap to common", () => {
    // Exit $30M: preferred is pinned at its $20M cap, common takes the rest.
    const wf = runWaterfall(ct, 30 * M);
    near(wf.series[0].total, 20 * M);
    near(wf.commonPool, 10 * M);
  });

  it("converts once as-converted beats the cap", () => {
    // At $50M, converting is worth 50% x $50M = $25M against a $20M cap.
    const wf = runWaterfall(ct, 50 * M);
    assert.equal(wf.series[0].converted, true);
    near(wf.series[0].total, 25 * M);
    near(wf.commonPricePerShare, 2.5);
  });
});

describe("seniority", () => {
  // Series B is senior: it is paid in full before Series A sees a dollar.
  const ct = table({
    commonShares: 10 * M,
    rounds: [
      round({ id: "A", invested: 5 * M, shares: 5 * M, seniority: 1 }),
      round({ id: "B", invested: 20 * M, shares: 10 * M, seniority: 0 }),
    ],
  });

  it("wipes out the junior series in a fire sale", () => {
    const wf = runWaterfall(ct, 15 * M);
    near(wf.series.find((s) => s.id === "B")!.total, 15 * M);
    near(wf.series.find((s) => s.id === "A")!.total, 0);
    near(wf.commonPool, 0);
  });

  it("pays the junior series only after the senior one is whole", () => {
    const wf = runWaterfall(ct, 23 * M);
    near(wf.series.find((s) => s.id === "B")!.total, 20 * M);
    near(wf.series.find((s) => s.id === "A")!.total, 3 * M);
    near(wf.commonPool, 0);
  });

  it("pro-rates within a pari passu tier", () => {
    const pari = table({
      commonShares: 10 * M,
      rounds: [
        round({ id: "A", invested: 5 * M, shares: 5 * M, seniority: 0 }),
        round({ id: "B", invested: 20 * M, shares: 10 * M, seniority: 0 }),
      ],
    });
    const wf = runWaterfall(pari, 10 * M);
    // $10M against $25M of claims: everyone recovers 40 cents on the dollar.
    near(wf.series.find((s) => s.id === "A")!.total, 2 * M);
    near(wf.series.find((s) => s.id === "B")!.total, 8 * M);
  });
});

describe("multi-round stack", () => {
  // A realistic Series C company: $85M of preference over 25M common shares.
  const ct = table({
    commonShares: 20 * M,
    optionPoolShares: 5 * M,
    rounds: [
      round({ id: "A", invested: 5 * M, shares: 5 * M, seniority: 2 }),
      round({ id: "B", invested: 20 * M, shares: 8 * M, seniority: 1 }),
      round({
        id: "C",
        invested: 60 * M,
        shares: 12 * M,
        seniority: 0,
        prefMultiple: 1,
        participating: true,
        participationCap: 3,
      }),
    ],
  });

  it("conserves dollars at every exit value", () => {
    for (const exit of [0, 10, 50, 85, 120, 300, 900, 2500].map((x) => x * M)) {
      const wf = runWaterfall(ct, exit);
      const total = wf.commonPool + wf.series.reduce((s, x) => s + x.total, 0);
      near(total, exit, Math.max(1, exit * 1e-9));
    }
  });

  it("pays common nothing below the preference overhang", () => {
    near(pps(ct, 84 * M), 0);
    assert.ok(pps(ct, 120 * M) > 0);
  });

  it("is monotonic — a bigger exit never pays common less", () => {
    let prev = -1;
    for (let exit = 0; exit <= 3000 * M; exit += 25 * M) {
      const value = pps(ct, exit);
      assert.ok(
        value >= prev - 1e-9,
        `price per share fell from ${prev} to ${value} at exit ${exit}`,
      );
      prev = value;
    }
  });

  it("never pays a series less than it could get by converting", () => {
    for (const exit of [40, 100, 250, 800, 2000].map((x) => x * M)) {
      const wf = runWaterfall(ct, exit);
      for (const s of wf.series) {
        const r = ct.rounds.find((x) => x.id === s.id)!;
        const asConverted = wf.commonPricePerShare * r.shares;
        assert.ok(
          s.total >= asConverted - 1,
          `${s.id} took ${s.total} but converting was worth ${asConverted} at ${exit}`,
        );
      }
    }
  });
});

/* ================================================================== */

describe("vesting", () => {
  it("counts whole elapsed months", () => {
    assert.equal(monthsBetween("2024-01-15", "2025-01-15"), 12);
    assert.equal(monthsBetween("2024-01-15", "2025-01-14"), 11);
    assert.equal(monthsBetween("2025-01-15", "2024-01-15"), 0);
  });

  const base: Grant = {
    shares: 48_000,
    strike: 1,
    type: "ISO",
    grantDate: "2024-01-01",
    vestMonths: 48,
    cliffMonths: 12,
    asOf: "2024-01-01",
    extraDilution: 0,
  };

  it("vests nothing before the cliff", () => {
    assert.equal(vestedShares({ ...base, asOf: "2024-11-30" }).vested, 0);
  });

  it("vests the whole first year at the cliff", () => {
    assert.equal(vestedShares({ ...base, asOf: "2025-01-01" }).vested, 12_000);
  });

  it("vests monthly after the cliff", () => {
    assert.equal(vestedShares({ ...base, asOf: "2025-07-01" }).vested, 18_000);
  });

  it("stops at the full grant", () => {
    assert.equal(vestedShares({ ...base, asOf: "2030-01-01" }).vested, 48_000);
  });
});

/* ================================================================== */

const tax: TaxAssumptions = {
  ordinaryRate: 0.45,
  capitalGainsRate: 0.28,
  amtRate: 0.28,
  strategy: "exercise-at-exit",
  currentFmv: 1,
};

function scenario(over: Partial<Scenario> = {}): Scenario {
  return {
    capTable: table({
      commonShares: 10 * M,
      rounds: [round({ id: "A", invested: 10 * M, shares: 10 * M })],
    }),
    grant: {
      shares: 100_000,
      strike: 1,
      type: "ISO",
      grantDate: "2020-01-01",
      vestMonths: 48,
      cliffMonths: 12,
      asOf: "2025-01-01",
      extraDilution: 0,
    },
    tax,
    maxExit: 500 * M,
    ...over,
  };
}

describe("employee outcome", () => {
  it("nets zero when the price per share does not clear the strike", () => {
    const s = scenario();
    // $15M exit: preferred takes its $10M preference, leaving common $0.50 a
    // share against a $1 strike. Exercising would cost more than it returns.
    const out = employeeOutcome(s, runWaterfall(s.capTable, 15 * M));
    near(out.commonPricePerShare, 0.5);
    assert.equal(out.underwater, true);
    assert.equal(out.net, 0);
  });

  it("subtracts the exercise cost and then the tax", () => {
    const s = scenario();
    const wf = runWaterfall(s.capTable, 60 * M);
    const out = employeeOutcome(s, wf);
    near(wf.commonPricePerShare, 3); // preferred converted: 50% of $60M over 20M shares
    near(out.gross, 300_000);
    near(out.exerciseCost, 100_000);
    near(out.spread, 200_000);
    near(out.tax, 90_000); // 45% of the spread
    near(out.net, 110_000);
  });

  it("applies extra dilution to your share count", () => {
    const s = scenario({
      grant: { ...scenario().grant, extraDilution: 0.25 },
    });
    const out = employeeOutcome(s, runWaterfall(s.capTable, 60 * M));
    near(out.effectiveShares, 75_000);
    near(out.gross, 225_000);
  });

  it("prices an early exercise at capital gains rates and surfaces the AMT", () => {
    const s = scenario({
      tax: { ...tax, strategy: "early-exercise", currentFmv: 2 },
    });
    const out = employeeOutcome(s, runWaterfall(s.capTable, 60 * M));
    near(out.tax, 200_000 * 0.28);
    // Bargain element: 100k shares x ($2 FMV - $1 strike), taxed at 28% AMT.
    near(out.amtEstimate, 100_000 * 0.28);
    near(out.cashRequiredToday, 100_000 + 28_000);
  });
});

describe("the waterline", () => {
  it("lands where the price per share crosses the strike", () => {
    const v = computeVerdict(scenario());
    assert.ok(v.waterline !== null);
    // 20M fully diluted shares against a $1 strike: the price per share only
    // clears the strike at a $20M exit, twice the headline post-money.
    near(v.waterline!, 20 * M, 20 * M * 1e-6);
  });

  it("sits above the preference overhang when there is a strike to clear", () => {
    const v = computeVerdict(scenario());
    assert.ok(v.waterline! > v.commonBreakeven!);
    near(v.commonBreakeven!, 10 * M, 10);
  });

  it("reports the headline number a recruiter would quote", () => {
    const v = computeVerdict(scenario());
    near(v.lastPreferredPrice, 1);
    near(v.headlineValue, 100_000);
    near(v.lastPostMoney, 20 * M);
  });

  it("ignores projected rounds when reading the headline price", () => {
    const s = scenario({
      capTable: table({
        commonShares: 10 * M,
        rounds: [
          round({ id: "A", invested: 10 * M, shares: 10 * M }),
          round({ id: "B", invested: 90 * M, shares: 10 * M, projected: true }),
        ],
      }),
    });
    near(computeVerdict(s).lastPreferredPrice, 1);
  });

  it("returns null when the strike can never be cleared", () => {
    const s = scenario({
      grant: { ...scenario().grant, shares: 0 },
    });
    assert.equal(computeVerdict(s).waterline, null);
  });
});
