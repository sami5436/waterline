"use client";

import type { EmployeeOutcome, Grant, TaxAssumptions } from "@/lib/waterfall/types";
import {
  dollars,
  percent,
  pricePerShare,
  shares as fmtShares,
} from "@/lib/waterfall/format";

/**
 * Every step from "options granted" to "money in your account", shown as
 * arithmetic so nothing about the headline number has to be taken on faith.
 */
export function YourMath({
  outcome,
  grant,
  tax,
}: {
  outcome: EmployeeOutcome;
  grant: Grant;
  tax: TaxAssumptions;
}) {
  const isRsu = grant.type === "RSU";
  const early = tax.strategy === "early-exercise" && !isRsu;

  return (
    <div>
      <Row label="Options granted" value={fmtShares(grant.shares)} />
      <Row
        label={`Vested (${percent(outcome.vestedFraction, 0)} at month ${outcome.monthsElapsed})`}
        value={fmtShares(outcome.vested)}
        muted
      />
      {grant.extraDilution > 0 ? (
        <Row
          label={`Less future dilution (${percent(grant.extraDilution, 0)})`}
          value={`−${fmtShares(outcome.vested - outcome.effectiveShares)}`}
          muted
        />
      ) : null}

      <Row label="Shares you'd hold" value={fmtShares(outcome.effectiveShares)} rule />

      <Row
        label="Price per common share at exit"
        value={pricePerShare(outcome.commonPricePerShare)}
        tone={outcome.underwater ? "neg" : "pos"}
      />
      <Row label="Gross value" value={dollars(outcome.gross)} />

      {!isRsu ? (
        <Row
          label={`Less exercise cost (${pricePerShare(grant.strike)} × shares)`}
          value={`−${dollars(outcome.exerciseCost)}`}
          tone="neg"
        />
      ) : null}

      <Row label="Spread" value={dollars(outcome.spread)} rule />

      <Row
        label={
          early
            ? `Less long-term capital gains (${percent(tax.capitalGainsRate, 0)})`
            : `Less ordinary income tax (${percent(tax.ordinaryRate, 0)})`
        }
        value={`−${dollars(outcome.tax)}`}
        tone="neg"
      />

      <Row label="You keep" value={dollars(outcome.net)} emphasis rule />

      {early ? (
        <div
          className="mt-6 border p-5"
          style={{
            borderColor: "color-mix(in srgb, var(--warn) 28%, transparent)",
            background: "var(--warn-soft)",
          }}
        >
          <div
            className="mb-3 text-[14px] font-semibold"
            style={{ color: "var(--warn)" }}
          >
            Cash you need first
          </div>
          <Row
            label="Exercise cost, payable today"
            value={dollars(outcome.effectiveShares * grant.strike)}
            small
          />
          <Row
            label={
              grant.type === "ISO"
                ? `Estimated AMT on the bargain element (${percent(tax.amtRate, 0)})`
                : `Ordinary income tax at exercise (${percent(tax.ordinaryRate, 0)})`
            }
            value={dollars(outcome.amtEstimate)}
            small
          />
          <Row
            label="Total out of pocket"
            value={dollars(outcome.cashRequiredToday)}
            small
            emphasis
            rule
          />
          <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
            This is real money, due years before any exit, on stock you cannot
            sell. If the company never gets above your waterline, none of it comes
            back — and{" "}
            {grant.type === "ISO"
              ? "the AMT you paid is only recoverable as a credit against future tax."
              : "the tax on the exercise is simply gone."}
          </p>
        </div>
      ) : null}

      <p className="mt-6 text-[13px] leading-relaxed text-fg-subtle">
        Tax figures are estimates from the flat rates above — they ignore
        brackets, the AMT exemption and its phase-out, QSBS, state-by-state
        treatment, and the holding periods that decide whether a sale qualifies
        for long-term rates. Useful for comparing scenarios, not for filing.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "fg",
  muted,
  emphasis,
  rule,
  small,
}: {
  label: string;
  value: string;
  tone?: "fg" | "pos" | "neg";
  muted?: boolean;
  emphasis?: boolean;
  rule?: boolean;
  small?: boolean;
}) {
  const color = { fg: undefined, pos: "var(--pos)", neg: "var(--neg)" }[tone];

  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        rule ? "mt-1 border-t border-line pt-3" : ""
      }`}
    >
      <span
        className={`leading-snug ${small ? "text-[13px]" : "text-[14px]"} ${
          muted ? "text-fg-subtle" : "text-fg-muted"
        }`}
      >
        {label}
      </span>
      <span
        className={`tnum shrink-0 ${
          emphasis
            ? "text-[17px] font-semibold text-fg"
            : small
              ? "text-[13px]"
              : "text-[14.5px] font-medium"
        } ${muted ? "text-fg-subtle" : "text-fg"}`}
        style={muted || emphasis ? undefined : { color }}
      >
        {value}
      </span>
    </div>
  );
}
