"use client";

import type { EmployeeOutcome, Scenario, Verdict } from "@/lib/waterfall/types";
import { dollars, money, percent, pricePerShare } from "@/lib/waterfall/format";

export function VerdictBand({
  scenario,
  verdict,
  outcome,
  exitValue,
}: {
  scenario: Scenario;
  verdict: Verdict;
  outcome: EmployeeOutcome;
  exitValue: number;
}) {
  const company = scenario.capTable.companyName;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Offer-letter math"
          value={money(verdict.headlineValue)}
          detail={`${scenario.grant.shares.toLocaleString("en-US")} shares at the ${pricePerShare(
            verdict.lastPreferredPrice,
          )} preferred price`}
        />
        <Stat
          label="Your waterline"
          tone={verdict.waterline === null ? "neg" : "warn"}
          value={verdict.waterline === null ? "Never" : money(verdict.waterline)}
          detail={
            verdict.waterline === null
              ? "No exit clears your strike price"
              : `${company} must sell above this before you see a dollar`
          }
        />
        <Stat
          label={`Net at a ${money(exitValue)} exit`}
          tone={outcome.net > 0 ? "pos" : "neg"}
          value={outcome.net > 0 ? money(outcome.net) : "$0"}
          detail={
            outcome.net > 0
              ? `${dollars(outcome.net)} after exercise cost and tax`
              : outcome.underwater
                ? "Below your strike — exercising loses money"
                : "Nothing left after the preference stack"
          }
        />
      </div>

      <p className="rounded-xl border border-line bg-card px-5 py-4 text-[14.5px] leading-relaxed text-fg-muted shadow-[var(--shadow-card)] sm:px-6">
        {summarize(scenario, verdict, outcome, exitValue)}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = "fg",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "fg" | "pos" | "neg" | "warn";
}) {
  const color = {
    fg: "var(--fg)",
    pos: "var(--pos)",
    neg: "var(--neg)",
    warn: "var(--warn)",
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="text-[13px] font-medium text-fg-subtle">{label}</div>
      <div
        className="figure mt-2 text-[2.25rem] leading-none sm:text-[2.5rem]"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-2.5 text-[13px] leading-snug text-fg-subtle">{detail}</div>
    </div>
  );
}

/**
 * A plain-English read of the gap between the headline number and the real one.
 * Picks whichever fact about this particular cap table is most worth saying.
 */
function summarize(
  scenario: Scenario,
  verdict: Verdict,
  outcome: EmployeeOutcome,
  exitValue: number,
): string {
  const company = scenario.capTable.companyName;
  const post = verdict.lastPostMoney;

  if (outcome.vested === 0) {
    return "Nothing has vested yet. Until you reach the cliff, none of this is yours — the numbers below show what the grant becomes once it starts vesting.";
  }

  if (verdict.waterline === null) {
    return `There is no exit value at which this grant is worth exercising: the preference stack absorbs the proceeds faster than the price per share can climb past your ${pricePerShare(
      scenario.grant.strike,
    )} strike.`;
  }

  const ratio = post > 0 ? verdict.waterline / post : 0;
  const overhang = verdict.preferenceOverhang;

  const lead =
    ratio >= 1
      ? `${company} would have to sell for ${ratio.toFixed(
          1,
        )}x its own last valuation before your options are worth exercising.`
      : ratio > 0
        ? `Your options start paying at ${percent(
            ratio,
            0,
          )} of ${company}'s last valuation — ${money(
            verdict.waterline,
          )} against a ${money(post)} post-money.`
        : `Your options start paying above a ${money(verdict.waterline)} exit.`;

  const stack =
    overhang > 0
      ? ` Investors are owed ${money(
          overhang,
        )} off the top, so the first ${money(
          overhang,
        )} of any sale never reaches common stock.`
      : " There is no preferred stock ahead of you, so every dollar of a sale splits evenly across shares.";

  const now =
    exitValue < verdict.waterline
      ? ` At the ${money(exitValue)} exit you're looking at, you are underwater.`
      : ` At ${money(exitValue)} you clear it — ${money(
          outcome.net,
        )} after exercise cost and tax, which is ${
          verdict.headlineValue > 0
            ? `${percent(outcome.net / verdict.headlineValue, 0)} of the offer-letter number.`
            : "your take-home."
        }`;

  return lead + stack + now;
}
