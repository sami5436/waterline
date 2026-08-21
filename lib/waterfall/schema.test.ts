import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeScenario } from "./schema.ts";
import { defaultScenario } from "./presets.ts";
import { computeVerdict, runWaterfall } from "./engine.ts";

/**
 * Share links round-trip scenarios through a database as untrusted JSON. The
 * normalizer is the only thing standing between that payload and the engine,
 * so it has to turn absolutely anything into something runnable.
 */
describe("normalizeScenario", () => {
  it("preserves a real scenario through a JSON round-trip", () => {
    const json = JSON.parse(JSON.stringify(defaultScenario));
    const out = normalizeScenario(json);

    // Optional fields come back filled in (`projected` becomes an explicit
    // false), so compare what actually matters: the engine's answer.
    assert.deepEqual(
      computeVerdict(out),
      computeVerdict(defaultScenario),
      "normalizing must not change the verdict",
    );
    assert.equal(out.capTable.companyName, defaultScenario.capTable.companyName);
    assert.equal(out.capTable.rounds.length, defaultScenario.capTable.rounds.length);
    assert.equal(out.grant.shares, defaultScenario.grant.shares);
    assert.equal(out.grant.strike, defaultScenario.grant.strike);
  });

  it("is idempotent — normalizing its own output changes nothing", () => {
    const once = normalizeScenario(JSON.parse(JSON.stringify(defaultScenario)));
    assert.deepEqual(normalizeScenario(once), once);
  });

  it("falls back to defaults for junk input", () => {
    for (const junk of [null, undefined, 42, "nope", [], true]) {
      const s = normalizeScenario(junk);
      assert.equal(s.capTable.companyName, defaultScenario.capTable.companyName);
      assert.ok(Number.isFinite(s.grant.shares));
    }
  });

  it("clamps numbers that would break the engine", () => {
    const s = normalizeScenario({
      capTable: { commonShares: -500, optionPoolShares: Infinity, rounds: [] },
      grant: { shares: NaN, strike: -3, extraDilution: 5, vestMonths: 99999 },
      tax: { ordinaryRate: 12, capitalGainsRate: -1 },
      maxExit: 0,
    });

    assert.equal(s.capTable.commonShares, 0);
    assert.ok(Number.isFinite(s.capTable.optionPoolShares));
    assert.ok(Number.isFinite(s.grant.shares));
    assert.equal(s.grant.strike, 0);
    assert.ok(s.grant.extraDilution <= 0.99);
    assert.ok(s.grant.vestMonths <= 240);
    assert.ok(s.tax.ordinaryRate <= 0.95);
    assert.equal(s.tax.capitalGainsRate, 0);
    assert.ok(s.maxExit >= 1e5);
  });

  it("caps the number of rounds", () => {
    const rounds = Array.from({ length: 40 }, (_, i) => ({
      id: `r${i}`,
      invested: 1e6,
      shares: 1e6,
    }));
    assert.ok(normalizeScenario({ capTable: { rounds } }).capTable.rounds.length <= 12);
  });

  it("rejects unknown enum values", () => {
    const s = normalizeScenario({
      grant: { type: "DROP TABLE scenarios" },
      tax: { strategy: "free-money" },
    });
    assert.ok(["ISO", "NSO", "RSU"].includes(s.grant.type));
    assert.ok(["exercise-at-exit", "early-exercise"].includes(s.tax.strategy));
  });

  it("rejects malformed dates", () => {
    const s = normalizeScenario({
      grant: { grantDate: "yesterday", asOf: "2026-13-45" },
    });
    assert.match(s.grant.grantDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(s.grant.asOf, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("truncates oversized strings", () => {
    const s = normalizeScenario({
      capTable: { companyName: "x".repeat(5000) },
    });
    assert.ok(s.capTable.companyName.length <= 60);
  });

  it("produces something the engine can always run", () => {
    const hostile = [
      {},
      { capTable: { rounds: [{ id: "a", invested: "abc", shares: {} }] } },
      { capTable: { commonShares: 0, optionPoolShares: 0, rounds: [] } },
      { capTable: { rounds: [{ id: "a", invested: 1e12, shares: 1, prefMultiple: 99 }] } },
    ];

    for (const input of hostile) {
      const scenario = normalizeScenario(input);
      const wf = runWaterfall(scenario.capTable, 5e8);
      assert.ok(Number.isFinite(wf.commonPricePerShare));
      assert.ok(Number.isFinite(wf.commonPool));
      assert.ok(Number.isFinite(computeVerdict(scenario).preferenceOverhang));
    }
  });
});
