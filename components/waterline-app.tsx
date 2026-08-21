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
import type { SaveResult } from "@/lib/scenarios";
import {
  scenarioToSimple,
  simpleToScenario,
  type SimpleInputs,
} from "@/lib/waterfall/simple";

import { CapTableEditor } from "./cap-table-editor";
import { Distribution } from "./distribution";
import { ExitChart } from "./exit-chart";
import { GrantEditor, TaxEditor } from "./grant-editor";
import { Lede } from "./lede";
import { ShareButton } from "./share-button";
import { SimpleCalculator } from "./simple-calculator";
import { ThemeToggle } from "./theme";
import { CardMeta, NumberInput, Section, Slider } from "./ui/controls";
import { YourMath } from "./your-math";

const SLIDER_STEPS = 1000;

/** Square-law slider: fine control down where the interesting kinks are. */
const toSlider = (exit: number, max: number) =>
  Math.sqrt(Math.min(1, Math.max(0, exit / max))) * SLIDER_STEPS;
const fromSlider = (pos: number, max: number) => (pos / SLIDER_STEPS) ** 2 * max;

export function WaterlineApp({
  initialScenario,
  saveAction,
  startsDetailed = false,
}: {
  initialScenario: Scenario;
  /**
   * Server action that persists a scenario and returns its slug. Omitted when
   * no database is configured, in which case sharing is simply absent and
   * everything else still works.
   */
  saveAction?: (scenario: Scenario) => Promise<SaveResult>;
  /** Shared links open on the full model — somebody built that cap table on purpose. */
  startsDetailed?: boolean;
}) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [exitValue, setExitValue] = useState(() => openingExit(initialScenario));

  /**
   * Simple mode asks five questions and gives one answer. Detailed mode is the
   * whole model. Opening in detailed mode buries the point under sixty inputs,
   * so we start simple and let people ask for more — except on a shared link,
   * where somebody deliberately built a cap table worth showing.
   */
  const [detailed, setDetailed] = useState(startsDetailed);
  const [simple, setSimple] = useState<SimpleInputs>(() =>
    scenarioToSimple(initialScenario),
  );

  const enterDetailed = () => {
    setScenario((s) => simpleToScenario(simple, s));
    setDetailed(true);
  };

  const leaveDetailed = () => {
    setSimple(scenarioToSimple(scenario));
    setDetailed(false);
  };

  const onSimpleInputs = (next: SimpleInputs) => {
    setSimple(next);
    setScenario((s) => {
      const updated = simpleToScenario(next, s);
      setExitValue((e) => Math.min(e, updated.maxExit));
      return updated;
    });
  };

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
    setSimple(scenarioToSimple(next));
    setExitValue(openingExit(next));
    // The examples exist to show what structure does, which only the full
    // model can express.
    setDetailed(true);
  }, []);

  const setMaxExit = (maxExit: number) => {
    setScenario((s) => ({ ...s, maxExit }));
    setExitValue((e) => Math.min(e, maxExit));
  };

  return (
    <div className="min-h-full">
      <Masthead
        onPick={loadPreset}
        toolbar={
          saveAction ? <ShareButton scenario={scenario} save={saveAction} /> : null
        }
      />

      <main className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        {detailed ? (
          <>
            <button
              type="button"
              onClick={leaveDetailed}
              className="mb-10 border-b border-line pb-0.5 text-[13.5px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
            >
              ← Back to the simple calculator
            </button>

        <Lede
          scenario={scenario}
          verdict={verdict}
          outcome={outcome}
          exitValue={exitValue}
        />

        <Section
          marker="The payout curve"
          className="mt-16"
          aside={<CardMeta>Drag the chart to move the exit price</CardMeta>}
        >
          <ExitChart
            curve={curve}
            verdict={verdict}
            exitValue={exitValue}
            netAtExit={outcome.net}
            onScrub={setExitValue}
          />

          <div className="mt-7 border-t border-line pt-6">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <div className="marker">If it sells for</div>
                <div className="figure mt-1.5 text-[2.2rem] leading-none text-fg">
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

            <div className="mt-5">
              <Slider
                value={toSlider(exitValue, scenario.maxExit)}
                onChange={(pos) => setExitValue(fromSlider(pos, scenario.maxExit))}
                min={0}
                max={SLIDER_STEPS}
                step={1}
                ariaLabel="Exit value"
                ariaValueText={money(exitValue)}
              />
              <div className="mt-1.5 flex justify-between text-[12.5px] text-fg-subtle">
                <span>$0</span>
                <span>{money(scenario.maxExit)}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Findings lead; the controls you reach into sit alongside them. */}
        <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="space-y-16">
            <Section
              marker={`Who gets paid at ${money(exitValue)}`}
              aside={
                <CardMeta>
                  {money(waterfall.totalPreferencePaid)} paid as preference
                </CardMeta>
              }
            >
              <Distribution
                waterfall={waterfall}
                rounds={scenario.capTable.rounds}
                outcome={outcome}
                exitValue={exitValue}
              />
            </Section>

            <Section marker="Your arithmetic">
              <YourMath
                outcome={outcome}
                grant={scenario.grant}
                tax={scenario.tax}
              />
            </Section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="marker">Assumptions</div>
            <div className="thickrule mt-3" />
            <div className="mt-6 space-y-4">
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
          </aside>
        </div>

          </>
        ) : (
          <SimpleCalculator
            inputs={simple}
            base={scenario}
            exitValue={exitValue}
            onInputs={onSimpleInputs}
            onExitValue={setExitValue}
            onExpand={enterDetailed}
          />
        )}

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
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <div className="flex items-baseline gap-3">
          <span className="display text-[22px] text-fg">Waterline</span>
          <span className="hidden text-[13px] text-fg-subtle sm:inline">
            what startup equity is actually worth
          </span>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden flex-wrap items-center gap-x-3 gap-y-1 sm:flex">
            <span className="text-[12px] text-fg-subtle">Examples</span>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                title={p.blurb}
                className="border-b border-transparent pb-px text-[12px] text-fg-subtle transition-colors hover:border-fg-muted hover:text-fg-muted"
              >
                {p.label}
              </button>
            ))}
          </nav>
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
          <div className="flex items-center gap-2">
            {toolbar}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

function Colophon() {
  return (
    <footer className="mt-20 border-t border-line pt-7 text-[13px] leading-relaxed text-fg-subtle">
      <p className="max-w-[68ch]">
        Waterline is a modelling tool, not financial, legal or tax advice. It
        works from the numbers you enter — and the ones that matter (preference
        multiples, participation, seniority, share counts) live in the charter
        and the stock purchase agreement, not the offer letter. Ask for them.
        Nothing you type leaves your browser unless you press Share.
      </p>
      <p className="mt-3">
        <a
          className="border-b border-line pb-0.5 transition-colors hover:border-fg hover:text-fg"
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
