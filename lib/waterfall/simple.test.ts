import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scenarioToSimple, simpleToScenario, type SimpleInputs } from "./simple.ts";
import { defaultScenario } from "./presets.ts";
import {
  computeVerdict,
  fullyDilutedShares,
  vestedShares,
} from "./engine.ts";

const M = 1_000_000;

const base = defaultScenario;
const inputs: SimpleInputs = {
  options: 40_000,
  strike: 0.9,
  valuation: 60 * M,
  totalRaised: 15 * M,
  fullyDiluted: 15 * M,
};

const near = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

describe("simple mode", () => {
  it("preserves the share count the user typed", () => {
    const s = simpleToScenario(inputs, base);
    near(fullyDilutedShares(s.capTable), inputs.fullyDiluted, 1);
  });

  it("gives investors the shares their money bought at that valuation", () => {
    const s = simpleToScenario(inputs, base);
    // $60M over 15M shares is $4 a share; $15M buys 3.75M of them.
    near(s.capTable.rounds[0].shares, 3.75 * M, 1);
    near(s.capTable.commonShares, 11.25 * M, 1);
  });

  it("models the standard deal", () => {
    const round = simpleToScenario(inputs, base).capTable.rounds[0];
    assert.equal(round.prefMultiple, 1);
    assert.equal(round.participating, false);
    assert.equal(round.participationCap, null);
  });

  it("treats the grant as fully vested", () => {
    const s = simpleToScenario(inputs, base);
    assert.equal(vestedShares(s.grant).vested, inputs.options);
    assert.equal(s.grant.extraDilution, 0);
  });

  it("puts the waterline above the preference stack", () => {
    const v = computeVerdict(simpleToScenario(inputs, base));
    assert.ok(v.waterline !== null);
    // Common sees nothing until the $15M preference is paid, and then has to
    // clear a $0.90 strike across 11.25M shares.
    near(v.waterline!, 25.125 * M, 25.125 * M * 1e-5);
    assert.ok(v.waterline! > v.preferenceOverhang);
  });

  it("drops the round entirely when nothing has been raised", () => {
    const s = simpleToScenario({ ...inputs, totalRaised: 0 }, base);
    assert.equal(s.capTable.rounds.length, 0);
    // With no preference, every share splits the exit evenly.
    near(computeVerdict(s).waterline!, 0.9 * 15 * M, 1000);
  });

  it("never drives common negative when the raise exceeds the valuation", () => {
    const s = simpleToScenario(
      { ...inputs, totalRaised: 500 * M, valuation: 20 * M },
      base,
    );
    assert.ok(s.capTable.commonShares >= 0);
    assert.ok(s.capTable.rounds[0].shares <= inputs.fullyDiluted);
    near(fullyDilutedShares(s.capTable), inputs.fullyDiluted, 1);
  });

  it("survives zero and nonsense values", () => {
    for (const bad of [
      { ...inputs, valuation: 0 },
      { ...inputs, fullyDiluted: 0 },
      { ...inputs, options: 0, strike: 0 },
    ]) {
      const s = simpleToScenario(bad, base);
      const v = computeVerdict(s);
      assert.ok(Number.isFinite(fullyDilutedShares(s.capTable)));
      assert.ok(Number.isFinite(v.preferenceOverhang));
      assert.ok(s.maxExit > 0);
    }
  });

  it("round-trips back out of a scenario it built", () => {
    const rebuilt = scenarioToSimple(simpleToScenario(inputs, base));
    near(rebuilt.options, inputs.options, 1);
    near(rebuilt.strike, inputs.strike, 1e-9);
    near(rebuilt.fullyDiluted, inputs.fullyDiluted, 1);
    near(rebuilt.totalRaised, inputs.totalRaised, 1);
    near(rebuilt.valuation, inputs.valuation, 1);
  });

  it("reads sensible inputs out of a real multi-round cap table", () => {
    const simple = scenarioToSimple(defaultScenario);
    assert.equal(simple.options, defaultScenario.grant.shares);
    near(simple.totalRaised, 15 * M, 1);
    near(simple.fullyDiluted, 15 * M, 1);
    // Series A priced at $12M for 3M shares, so $4 across 15M shares.
    near(simple.valuation, 60 * M, 1);
  });
});
