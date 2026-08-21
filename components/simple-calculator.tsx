"use client";

import { useMemo } from "react";
import {
  computeVerdict,
  employeeOutcome,
  runWaterfall,
  sampleCurve,
} from "@/lib/waterfall/engine";
import { money, pricePerShare } from "@/lib/waterfall/format";
import { simpleToScenario, type SimpleInputs } from "@/lib/waterfall/simple";
import type { Scenario } from "@/lib/waterfall/types";

import { ExitChart } from "./exit-chart";
import { Field, NumberInput, Slider } from "./ui/controls";

const SLIDER_STEPS = 1000;
const toSlider = (exit: number, max: number) =>
  Math.sqrt(Math.min(1, Math.max(0, exit / max))) * SLIDER_STEPS;
const fromSlider = (pos: number, max: number) => (pos / SLIDER_STEPS) ** 2 * max;

export function SimpleCalculator({
  inputs,
  base,
  exitValue,
  onInputs,
  onExitValue,
  onExpand,
}: {
  inputs: SimpleInputs;
  base: Scenario;
  exitValue: number;
  onInputs: (next: SimpleInputs) => void;
  onExitValue: (next: number) => void;
  onExpand: () => void;
}) {
  const scenario = useMemo(() => simpleToScenario(inputs, base), [inputs, base]);
  const verdict = useMemo(() => computeVerdict(scenario), [scenario]);
  const waterfall = useMemo(
    () => runWaterfall(scenario.capTable, exitValue),
    [scenario.capTable, exitValue],
  );
  const outcome = useMemo(
    () => employeeOutcome(scenario, waterfall),
    [scenario, waterfall],
  );
  const curve = useMemo(
    () => sampleCurve(scenario, 140, [verdict.waterline ?? 0, verdict.preferenceOverhang]),
    [scenario, verdict],
  );

  const set = (partial: Partial<SimpleInputs>) => onInputs({ ...inputs, ...partial });
  const quoted = inputs.options * (verdict.lastPreferredPrice || 0);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-14">
      {/* Five questions. */}
      <div>
        <h2 className="display text-[1.7rem] leading-tight text-fg">
          What are your options really worth?
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">
          Investors get paid before you do. Fill in five numbers and see the
          price your company has to sell for before your options are worth
          anything at all.
        </p>

        <div className="mt-7 space-y-4">
          <Field label="Options you were granted">
            <NumberInput
              value={inputs.options}
              onChange={(options) => set({ options })}
              format="grouped"
              ariaLabel="Options granted"
            />
          </Field>
          <Field label="Your strike price" hint="Per share. It's on your offer letter.">
            <NumberInput
              value={inputs.strike}
              onChange={(strike) => set({ strike })}
              prefix="$"
              ariaLabel="Strike price"
            />
          </Field>
          <Field
            label="The company's valuation"
            hint="What it was last valued at. Try 60m, 1.2b."
          >
            <NumberInput
              value={inputs.valuation}
              onChange={(valuation) => set({ valuation })}
              prefix="$"
              format="compact"
              min={0}
              ariaLabel="Company valuation"
            />
          </Field>
          <Field
            label="Total raised from investors"
            hint="Every round added together. This is the money that gets paid back first."
          >
            <NumberInput
              value={inputs.totalRaised}
              onChange={(totalRaised) => set({ totalRaised })}
              prefix="$"
              format="compact"
              min={0}
              ariaLabel="Total raised"
            />
          </Field>
          <Field
            label="Total shares in the company"
            hint="Fully diluted. Ask HR if you don't have it."
          >
            <NumberInput
              value={inputs.fullyDiluted}
              onChange={(fullyDiluted) => set({ fullyDiluted })}
              format="grouped"
              min={1}
              ariaLabel="Fully diluted shares"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={onExpand}
          className="mt-7 border-b border-line pb-0.5 text-[13.5px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
        >
          My cap table is more complicated than this →
        </button>
        <p className="mt-2 text-[12.5px] leading-snug text-fg-subtle">
          Adds vesting, individual rounds, participation rights, seniority and
          tax.
        </p>
      </div>

      {/* One answer. */}
      <div>
        <div className="marker">If it sells for {money(exitValue)}</div>
        <div className="thickrule mt-3" />

        <div className="mt-7 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="text-[13.5px] text-fg-muted">You&rsquo;d walk away with</div>
            <div
              className="figure mt-2 text-[3rem] leading-none sm:text-[3.4rem]"
              style={{ color: outcome.net > 0 ? "var(--pos)" : "var(--neg)" }}
            >
              {outcome.net > 0 ? money(outcome.net) : "$0"}
            </div>
            <div className="mt-2.5 text-[13px] leading-snug text-fg-subtle">
              {outcome.net > 0
                ? `After paying ${money(outcome.exerciseCost)} to exercise, and tax`
                : outcome.underwater
                  ? `The shares are worth ${pricePerShare(
                      outcome.commonPricePerShare,
                    )} — less than your ${pricePerShare(inputs.strike)} strike`
                  : "Investors take everything at this price"}
            </div>
          </div>

          <div>
            <div className="text-[13.5px] text-fg-muted">
              Your options are worth nothing below
            </div>
            <div
              className="figure mt-2 text-[3rem] leading-none sm:text-[3.4rem]"
              style={{ color: "var(--neg)" }}
            >
              {verdict.waterline === null ? "Any price" : money(verdict.waterline)}
            </div>
            <div className="mt-2.5 text-[13px] leading-snug text-fg-subtle">
              {quoted > 0 ? (
                <>
                  A recruiter would call this grant {money(quoted)}
                  {verdict.waterline !== null && inputs.valuation > 0 ? (
                    <>
                      {" "}
                      — but the company is valued at {money(inputs.valuation)} today
                    </>
                  ) : null}
                </>
              ) : (
                "Enter a valuation to compare against the quoted number"
              )}
            </div>
          </div>
        </div>

        <div className="mt-10">
          <ExitChart
            curve={curve}
            verdict={verdict}
            exitValue={exitValue}
            netAtExit={outcome.net}
            onScrub={onExitValue}
          />
          <div className="mt-5">
            <Slider
              value={toSlider(exitValue, scenario.maxExit)}
              onChange={(pos) => onExitValue(fromSlider(pos, scenario.maxExit))}
              min={0}
              max={SLIDER_STEPS}
              step={1}
              ariaLabel="Sale price"
              ariaValueText={money(exitValue)}
            />
            <div className="mt-1.5 flex justify-between text-[12.5px] text-fg-subtle">
              <span>Drag to change the sale price</span>
              <span>{money(scenario.maxExit)}</span>
            </div>
          </div>
        </div>

        <p className="mt-7 border-t border-line pt-5 text-[13px] leading-relaxed text-fg-subtle">
          Assumes the standard deal — investors hold a 1× non-participating
          preference — and that you&rsquo;re fully vested. If your company took
          money on harder terms, or you&rsquo;re part-way through vesting, the
          full view will tell you a different and usually worse number.
        </p>
      </div>
    </div>
  );
}
