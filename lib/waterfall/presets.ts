import type { Scenario } from "./types";

const M = 1_000_000;

export interface Preset {
  id: string;
  label: string;
  /** One line on what this cap table is meant to teach. */
  blurb: string;
  scenario: Scenario;
}

const today = "2026-01-01";

/**
 * Three cap tables that produce very different answers from very similar
 * headline numbers. They are composites of common structures, not real
 * companies.
 */
export const presets: Preset[] = [
  {
    id: "clean",
    label: "Clean Series A",
    blurb:
      "Plain 1x non-participating preferred, no structure. Roughly what a healthy early-stage deal looks like.",
    scenario: {
      capTable: {
        companyName: "Northgate",
        commonShares: 8 * M,
        optionPoolShares: 2 * M,
        rounds: [
          {
            id: "seed",
            name: "Seed",
            invested: 3 * M,
            shares: 2 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 1,
          },
          {
            id: "a",
            name: "Series A",
            invested: 12 * M,
            shares: 3 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 0,
          },
        ],
      },
      grant: {
        shares: 40_000,
        strike: 0.9,
        type: "ISO",
        grantDate: "2023-03-01",
        vestMonths: 48,
        cliffMonths: 12,
        asOf: today,
        extraDilution: 0.15,
      },
      tax: {
        ordinaryRate: 0.45,
        capitalGainsRate: 0.28,
        amtRate: 0.28,
        strategy: "exercise-at-exit",
        currentFmv: 1.6,
      },
      maxExit: 300 * M,
    },
  },
  {
    id: "structured",
    label: "The 2021 mega-round",
    blurb:
      "A billion-dollar headline valuation propped up by $408M of preference, including a participating crossover round. The gap between the sticker price and your waterline is the whole point.",
    scenario: {
      capTable: {
        companyName: "Halcyon Robotics",
        commonShares: 30 * M,
        optionPoolShares: 8 * M,
        rounds: [
          {
            id: "a",
            name: "Series A",
            invested: 8 * M,
            shares: 6 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 3,
          },
          {
            id: "b",
            name: "Series B",
            invested: 30 * M,
            shares: 10 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 2,
          },
          {
            id: "c",
            name: "Series C",
            invested: 120 * M,
            shares: 15 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 1,
          },
          {
            id: "d",
            name: "Series D",
            invested: 250 * M,
            shares: 20 * M,
            prefMultiple: 1,
            participating: true,
            participationCap: null,
            seniority: 0,
          },
        ],
      },
      grant: {
        shares: 60_000,
        strike: 4.2,
        type: "ISO",
        grantDate: "2022-06-01",
        vestMonths: 48,
        cliffMonths: 12,
        asOf: today,
        extraDilution: 0.1,
      },
      tax: {
        ordinaryRate: 0.45,
        capitalGainsRate: 0.28,
        amtRate: 0.28,
        strategy: "exercise-at-exit",
        currentFmv: 5.1,
      },
      maxExit: 2_000 * M,
    },
  },
  {
    id: "capped",
    label: "Structured Series C",
    blurb:
      "A 2x participating Series C capped at 2.5x. Watch the payout curve bend twice as caps bind and preferred series flip to common.",
    scenario: {
      capTable: {
        companyName: "Meridian Health",
        commonShares: 22 * M,
        optionPoolShares: 6 * M,
        rounds: [
          {
            id: "a",
            name: "Series A",
            invested: 6 * M,
            shares: 5 * M,
            prefMultiple: 1,
            participating: false,
            participationCap: null,
            seniority: 2,
          },
          {
            id: "b",
            name: "Series B",
            invested: 18 * M,
            shares: 7 * M,
            prefMultiple: 1,
            participating: true,
            participationCap: 3,
            seniority: 1,
          },
          {
            id: "c",
            name: "Series C",
            invested: 45 * M,
            shares: 9 * M,
            prefMultiple: 2,
            participating: true,
            participationCap: 2.5,
            seniority: 0,
          },
        ],
      },
      grant: {
        shares: 25_000,
        strike: 2.1,
        type: "ISO",
        grantDate: "2023-09-01",
        vestMonths: 48,
        cliffMonths: 12,
        asOf: today,
        extraDilution: 0.12,
      },
      tax: {
        ordinaryRate: 0.45,
        capitalGainsRate: 0.28,
        amtRate: 0.28,
        strategy: "exercise-at-exit",
        currentFmv: 3.4,
      },
      maxExit: 900 * M,
    },
  },
];

export const defaultScenario: Scenario = presets[0].scenario;

export function clonePreset(id: string): Scenario {
  const preset = presets.find((p) => p.id === id) ?? presets[0];
  return structuredClone(preset.scenario);
}
