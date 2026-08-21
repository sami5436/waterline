"use client";

import type { Grant, TaxAssumptions } from "@/lib/waterfall/types";
import { percent, shares as fmtShares } from "@/lib/waterfall/format";
import { vestedShares } from "@/lib/waterfall/engine";
import {
  Card,
  CardMeta,
  DateInput,
  Field,
  NumberInput,
  SegmentedControl,
  Slider,
} from "./ui/controls";

export function GrantEditor({
  grant,
  onChange,
}: {
  grant: Grant;
  onChange: (next: Grant) => void;
}) {
  const patch = (partial: Partial<Grant>) => onChange({ ...grant, ...partial });
  const { vested, fraction, monthsElapsed } = vestedShares(grant);

  return (
    <Card
      title="Your grant"
      aside={<CardMeta>{fmtShares(vested)} vested</CardMeta>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          <Field label="Options granted">
            <NumberInput
              value={grant.shares}
              onChange={(shares) => patch({ shares })}
              format="grouped"
              ariaLabel="Options granted"
            />
          </Field>
          <Field label="Strike price">
            <NumberInput
              value={grant.strike}
              onChange={(strike) => patch({ strike })}
              prefix="$"
              ariaLabel="Strike price per share"
            />
          </Field>
        </div>

        <Field label="Instrument">
          <SegmentedControl
            ariaLabel="Grant type"
            value={grant.type}
            onChange={(type) =>
              patch({ type, strike: type === "RSU" ? 0 : grant.strike })
            }
            options={[
              { value: "ISO", label: "ISO", title: "Incentive stock options" },
              { value: "NSO", label: "NSO", title: "Non-qualified stock options" },
              {
                value: "RSU",
                label: "RSU",
                title: "Restricted stock units — no strike to pay",
              },
            ]}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          <Field label="Vesting start">
            <DateInput
              value={grant.grantDate}
              onChange={(grantDate) => patch({ grantDate })}
              ariaLabel="Vesting commencement date"
            />
          </Field>
          <Field label="Vested as of">
            <DateInput
              value={grant.asOf}
              onChange={(asOf) => patch({ asOf })}
              ariaLabel="Date to evaluate vesting"
            />
          </Field>
          <Field label="Vesting period">
            <NumberInput
              value={grant.vestMonths}
              onChange={(vestMonths) => patch({ vestMonths })}
              min={0}
              max={240}
              suffix="mo"
              ariaLabel="Total vesting months"
            />
          </Field>
          <Field label="Cliff">
            <NumberInput
              value={grant.cliffMonths}
              onChange={(cliffMonths) => patch({ cliffMonths })}
              min={0}
              max={240}
              suffix="mo"
              ariaLabel="Cliff in months"
            />
          </Field>
        </div>

        <div className="rounded-xl bg-muted px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] text-fg-muted">
              Vested at month {monthsElapsed}
            </span>
            <span className="tnum text-[14px] font-semibold text-fg">
              {fmtShares(vested)}
              <span className="ml-1.5 font-normal text-fg-subtle">
                {percent(fraction, 0)}
              </span>
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.min(100, fraction * 100)}%`,
                background: "var(--pos)",
              }}
            />
          </div>
        </div>

        <Field
          label={`Future dilution — ${percent(grant.extraDilution, 0)}`}
          hint="Pool refreshes and issuance you haven't modelled as rounds. Shrinks your slice before the exit."
        >
          <Slider
            value={grant.extraDilution}
            onChange={(extraDilution) => patch({ extraDilution })}
            min={0}
            max={0.6}
            step={0.01}
            ariaLabel="Expected future dilution"
            ariaValueText={percent(grant.extraDilution, 0)}
          />
        </Field>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function TaxEditor({
  tax,
  grantType,
  onChange,
}: {
  tax: TaxAssumptions;
  grantType: Grant["type"];
  onChange: (next: TaxAssumptions) => void;
}) {
  const patch = (partial: Partial<TaxAssumptions>) => onChange({ ...tax, ...partial });
  const early = tax.strategy === "early-exercise";

  return (
    <Card title="Exercise & tax">
      <div className="space-y-5">
        <Field
          label="Strategy"
          hint={
            early
              ? "Exercise now while the 409A is low, hold past the long-term window, and pay capital gains at the exit. The bill arrives years before the money does."
              : "Exercise and sell on the same day. Simple, no cash up front — and the entire spread is ordinary income."
          }
        >
          <SegmentedControl
            ariaLabel="Exercise strategy"
            value={tax.strategy}
            onChange={(strategy) => patch({ strategy })}
            options={[
              { value: "exercise-at-exit", label: "Exercise at exit" },
              { value: "early-exercise", label: "Exercise early" },
            ]}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          <Field label="Ordinary rate">
            <NumberInput
              value={round2(tax.ordinaryRate * 100)}
              onChange={(v) => patch({ ordinaryRate: v / 100 })}
              min={0}
              max={95}
              suffix="%"
              ariaLabel="Combined ordinary income tax rate"
            />
          </Field>
          <Field label="Capital gains rate">
            <NumberInput
              value={round2(tax.capitalGainsRate * 100)}
              onChange={(v) => patch({ capitalGainsRate: v / 100 })}
              min={0}
              max={95}
              suffix="%"
              ariaLabel="Long-term capital gains rate"
            />
          </Field>
        </div>

        {early && grantType !== "RSU" ? (
          <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
            <Field label="Current 409A" hint="Fair market value per common share today.">
              <NumberInput
                value={tax.currentFmv}
                onChange={(currentFmv) => patch({ currentFmv })}
                prefix="$"
                ariaLabel="Current 409A fair market value"
              />
            </Field>
            <Field label="AMT rate" hint="Applied to the ISO bargain element.">
              <NumberInput
                value={round2(tax.amtRate * 100)}
                onChange={(v) => patch({ amtRate: v / 100 })}
                min={0}
                max={95}
                suffix="%"
                ariaLabel="Alternative minimum tax rate"
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
