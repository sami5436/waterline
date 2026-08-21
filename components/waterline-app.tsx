"use client";

import { useCallback, useMemo, useState } from "react";
import {
  computeVerdict,
  employeeOutcome,
  runWaterfall,
  sampleCurve,
} from "@/lib/waterfall/engine";
import { clonePreset, presets } from "@/lib/waterfall/presets";
import { money } from "@/lib/waterfall/format";
import type { Scenario } from "@/lib/waterfall/types";

import { CapTableEditor } from "./cap-table-editor";
import { Distribution } from "./distribution";
import { ExitChart } from "./exit-chart";
import { GrantEditor, TaxEditor } from "./grant-editor";
import { ThemeToggle } from "./theme";
import { Card, CardMeta, NumberInput, Slider } from "./ui/controls";
import { VerdictBand } from "./verdict-band";
import { YourMath } from "./your-math";

const SLIDER_STEPS = 1000;

/** Square-law slider: fine control down where the interesting kinks are. */
const toSlider = (exit: number, max: number) =>
  Math.sqrt(Math.min(1, Math.max(0, exit / max))) * SLIDER_STEPS;
const fromSlider = (pos: number, max: number) => (pos / SLIDER_STEPS) ** 2 * max;

export function WaterlineApp({
  initialScenario,
  toolbar,
}: {
  initialScenario: Scenario;
  /** Slot for the share controls, which need server access. */
  toolbar?: (scenario: Scenario) => React.ReactNode;
}) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [exitValue, setExitValue] = useState(() => openingExit(initialScenario));

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
    () =>
      sampleCurve(scenario, 170, [
        verdict.waterline ?? 0,
        verdict.commonBreakeven ?? 0,
        verdict.preferenceOverhang,
      ]),
    [scenario, verdict],
  );

  const loadPreset = useCallback((id: string) => {
    const next = clonePreset(id);
    setScenario(next);
    setExitValue(openingExit(next));
  }, []);

  const setMaxExit = (maxExit: number) => {
    setScenario((s) => ({ ...s, maxExit }));
    setExitValue((e) => Math.min(e, maxExit));
  };

  return (
    <div className="min-h-full">
      <Masthead onPick={loadPreset} toolbar={toolbar?.(scenario)} />

      <main className="mx-auto w-full max-w-[1360px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="space-y-4 sm:space-y-5">
          <VerdictBand
            scenario={scenario}
            verdict={verdict}
            outcome={outcome}
            exitValue={exitValue}
          />

          <Card
            title="Payout curve"
            aside={<CardMeta>Drag the chart or the slider</CardMeta>}
          >
            <ExitChart
              curve={curve}
              verdict={verdict}
              exitValue={exitValue}
              netAtExit={outcome.net}
              onScrub={setExitValue}
            />

            <div className="mt-6 border-t border-line pt-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-fg-subtle">
                    Exit value
                  </div>
                  <div className="figure mt-1 text-[1.9rem] leading-none text-fg">
                    {money(exitValue)}
                  </div>
                </div>
                <label className="flex items-center gap-2.5">
                  <span className="text-[13px] text-fg-subtle">Chart max</span>
                  <div className="w-28">
                    <NumberInput
                      value={scenario.maxExit}
                      onChange={setMaxExit}
                      min={1_000_000}
                      max={1e13}
                      prefix="$"
                      format="compact"
                      ariaLabel="Maximum exit value on the chart"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-4">
                <Slider
                  value={toSlider(exitValue, scenario.maxExit)}
                  onChange={(pos) => setExitValue(fromSlider(pos, scenario.maxExit))}
                  min={0}
                  max={SLIDER_STEPS}
                  step={1}
                  ariaLabel="Exit value"
                  ariaValueText={money(exitValue)}
                />
                <div className="mt-1 flex justify-between text-[12.5px] text-fg-subtle">
                  <span>$0</span>
                  <span>{money(scenario.maxExit)}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className="space-y-4 sm:space-y-5">
              <GrantEditor
                grant={scenario.grant}
                onChange={(grant) => setScenario((s) => ({ ...s, grant }))}
              />
              <CapTableEditor
                capTable={scenario.capTable}
                onChange={(capTable) => setScenario((s) => ({ ...s, capTable }))}
              />
              <TaxEditor
                tax={scenario.tax}
                grantType={scenario.grant.type}
                onChange={(tax) => setScenario((s) => ({ ...s, tax }))}
              />
            </div>

            <div className="space-y-4 sm:space-y-5 lg:order-first lg:col-start-2 lg:row-start-1">
              <Card
                title={`Who gets paid at a ${money(exitValue)} exit`}
                aside={
                  <CardMeta>{money(waterfall.totalPreferencePaid)} in preference</CardMeta>
                }
              >
                <Distribution
                  waterfall={waterfall}
                  rounds={scenario.capTable.rounds}
                  outcome={outcome}
                  exitValue={exitValue}
                />
              </Card>

              <Card title="Your arithmetic">
                <YourMath
                  outcome={outcome}
                  grant={scenario.grant}
                  tax={scenario.tax}
                />
              </Card>
            </div>
          </div>
        </div>

        <Colophon />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Masthead({
  onPick,
  toolbar,
}: {
  onPick: (id: string) => void;
  toolbar?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto w-full max-w-[1360px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {/* Wordmark and controls share the top row at every width; the
            description flows beneath at full measure. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <WaveMark />
            <span className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
              Waterline
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {toolbar}
            <ThemeToggle />
          </div>
        </div>

        <h1 className="mt-3.5 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Your offer letter quotes a number. Liquidation preferences,
          participation rights and dilution decide the real one. Waterline runs
          the full exit waterfall and finds the price below which your common
          stock pays you{" "}
          <span className="font-medium" style={{ color: "var(--neg)" }}>
            nothing at all
          </span>
          .
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] text-fg-subtle">Start from</span>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              title={p.blurb}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function WaveMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" style={{ fill: "var(--accent)" }} />
      <path
        d="M6 12.5c3-3.5 6-3.5 9 0s6 3.5 9 0"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 17v9"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="2.5 3"
        opacity="0.75"
      />
    </svg>
  );
}

function Colophon() {
  return (
    <footer className="mt-10 border-t border-line pt-6 text-[13px] leading-relaxed text-fg-subtle">
      <p className="max-w-3xl">
        Waterline is a modelling tool, not financial, legal or tax advice. It
        works from the numbers you enter — and the ones that matter (preference
        multiples, participation, seniority, share counts) usually live in the
        charter and the stock purchase agreement rather than the offer letter, so
        ask for them. Nothing you type is uploaded unless you press Share.
      </p>
      <p className="mt-3">
        <a
          className="underline decoration-line underline-offset-2 transition-colors hover:text-accent"
          href="https://github.com/sami5436/waterline"
          target="_blank"
          rel="noreferrer"
        >
          github.com/sami5436/waterline
        </a>
      </p>
    </footer>
  );
}

/**
 * Opens on the company's own last valuation — the number people already have in
 * their head — so the first thing they see is how it compares to the waterline.
 */
function openingExit(scenario: Scenario): number {
  const verdict = computeVerdict(scenario);
  const anchor =
    verdict.lastPostMoney > 0 ? verdict.lastPostMoney : scenario.maxExit / 3;
  return Math.min(scenario.maxExit, anchor);
}
