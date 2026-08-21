"use client";

import type { EmployeeOutcome, Scenario, Verdict } from "@/lib/waterfall/types";
import { dollars, money, percent, pricePerShare, shares } from "@/lib/waterfall/format";

/**
 * The lede: the whole finding stated as a sentence, with the two numbers that
 * disagree set large enough to read from across the room. Everything else on
 * the page is evidence for this paragraph.
 */
export function Lede({
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
    <section>
      <div className="marker">{company} · your grant</div>
      <div className="thickrule mt-3" />

      <p className="display mt-7 max-w-[22ch] text-[clamp(1.9rem,5.6vw,3.4rem)] text-fg sm:max-w-[30ch]">
        {sentence(scenario, verdict, outcome)}
      </p>

      {/* Figures separated by rules, not stacked in boxes. */}
      <dl className="mt-9 grid grid-cols-1 gap-y-7 border-t border-line pt-7 sm:grid-cols-3 sm:gap-x-8 sm:gap-y-0">
        <Figure
          term="Offer-letter math"
          value={money(verdict.headlineValue)}
          detail={`${shares(scenario.grant.shares)} shares × ${pricePerShare(
            verdict.lastPreferredPrice,
          )}, the price of the last round`}
        />
        <Figure
          term="Your waterline"
          tone="neg"
          divider
          value={verdict.waterline === null ? "Never" : money(verdict.waterline)}
          detail={
            verdict.waterline === null
              ? "No exit price clears your strike"
              : `${company} must sell above this before a single dollar reaches you`
          }
        />
        <Figure
          term={`Net at a ${money(exitValue)} exit`}
          tone={outcome.net > 0 ? "pos" : "neg"}
          divider
          value={outcome.net > 0 ? money(outcome.net) : "$0"}
          detail={
            outcome.net > 0
              ? `${dollars(outcome.net)} after exercise cost and tax`
              : outcome.underwater
                ? "The share price never clears your strike here"
                : "The preference stack absorbs everything"
          }
        />
      </dl>
    </section>
  );
}

function Figure({
  term,
  value,
  detail,
  tone = "fg",
  divider,
}: {
  term: string;
  value: string;
  detail: string;
  tone?: "fg" | "pos" | "neg";
  divider?: boolean;
}) {
  const color = { fg: "var(--fg)", pos: "var(--pos)", neg: "var(--neg)" }[tone];

  return (
    <div className={divider ? "sm:border-l sm:border-line sm:pl-8" : undefined}>
      <dt className="marker">{term}</dt>
      <dd>
        <div
          className="figure mt-2 text-[2.4rem] leading-[1] sm:text-[2.7rem]"
          style={{ color }}
        >
          {value}
        </div>
        <p className="mt-2.5 max-w-[34ch] text-[13.5px] leading-snug text-fg-subtle">
          {detail}
        </p>
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const Num = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "pos" | "neg";
}) => (
  <span
    className="whitespace-nowrap"
    style={tone ? { color: tone === "pos" ? "var(--pos)" : "var(--neg)" } : undefined}
  >
    {children}
  </span>
);

/** Picks the sentence that this particular cap table actually warrants. */
function sentence(
  scenario: Scenario,
  verdict: Verdict,
  outcome: EmployeeOutcome,
): React.ReactNode {
  const company = scenario.capTable.companyName;
  const grantShares = shares(scenario.grant.shares);

  if (outcome.vested === 0) {
    return (
      <>
        None of your {grantShares} options have vested yet. Here is what they
        become once they do.
      </>
    );
  }

  if (verdict.waterline === null) {
    return (
      <>
        There is no price at which {company} can sell that makes your{" "}
        {grantShares} options worth <Num tone="neg">exercising</Num>.
      </>
    );
  }

  const post = verdict.lastPostMoney;
  const ratio = post > 0 ? verdict.waterline / post : 0;

  return (
    <>
      Your {grantShares} options are quoted at{" "}
      <Num>{money(verdict.headlineValue)}</Num>. They are worth{" "}
      <em className="italic">nothing</em> until {company} sells for{" "}
      <Num tone="neg">{money(verdict.waterline)}</Num>
      {ratio >= 1.05 ? (
        <>
          {" "}
          — {ratio.toFixed(1)}× its own last valuation.
        </>
      ) : ratio > 0 ? (
        <>
          {" "}
          — {percent(ratio, 0)} of its last valuation.
        </>
      ) : (
        "."
      )}
    </>
  );
}
