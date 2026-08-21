"use client";

import type { EmployeeOutcome, Round, WaterfallResult } from "@/lib/waterfall/types";
import { money, multiple, percent, pricePerShare } from "@/lib/waterfall/format";

/**
 * Preferred series recede into greys; common takes the positive colour and your
 * slice takes the accent. All resolved from CSS variables so the bar re-themes
 * with the rest of the page.
 */
const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];
const COMMON_COLOR = "var(--pos)";
const YOU_COLOR = "var(--accent)";

export function Distribution({
  waterfall,
  rounds,
  outcome,
  exitValue,
}: {
  waterfall: WaterfallResult;
  rounds: Round[];
  outcome: EmployeeOutcome;
  exitValue: number;
}) {
  const total = Math.max(exitValue, 1);
  const yourShare = outcome.gross;

  const segments = [
    ...waterfall.series.map((s, i) => ({
      key: s.id,
      label: s.name,
      value: s.total,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    })),
    {
      key: "__common__",
      label: "Common + pool",
      value: waterfall.commonPool,
      color: COMMON_COLOR,
    },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* The whole exit, left to right, in payout order. */}
      <div>
        <div className="flex h-12 w-full gap-0.5 overflow-hidden rounded-lg bg-muted">
          {segments.length === 0 ? (
            <div className="flex w-full items-center justify-center text-[13px] text-fg-subtle">
              Nothing to distribute
            </div>
          ) : (
            segments.map((s) => {
              const pct = s.value / total;
              const isCommon = s.key === "__common__";
              return (
                <div
                  key={s.key}
                  className="relative min-w-[3px] transition-[flex-grow] duration-150"
                  style={{ flexGrow: pct, flexBasis: 0, background: s.color }}
                  title={`${s.label}: ${money(s.value)} (${percent(pct, 1)})`}
                >
                  {/* Your slice, drawn to scale inside the common segment. */}
                  {isCommon && yourShare > 0 ? (
                    <div
                      className="absolute inset-y-0 right-0 min-w-[3px]"
                      style={{
                        width: `${Math.min(100, (yourShare / s.value) * 100)}%`,
                        background: YOU_COLOR,
                      }}
                    />
                  ) : null}
                  {pct > 0.1 ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-[12px] font-semibold text-[color:var(--on-series)]">
                      {percent(pct, 0)}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {segments.map((s) => (
            <Legend key={s.key} color={s.color} label={s.label} />
          ))}
          {yourShare > 0 ? (
            <Legend
              color={YOU_COLOR}
              label={`You — ${percent(outcome.ownershipFraction, 3)}`}
            />
          ) : null}
        </div>
      </div>

      {/* The same thing as numbers. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[460px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <Th className="text-left">Holder</Th>
              <Th className="text-left">Outcome</Th>
              <Th className="text-right">Proceeds</Th>
              <Th className="text-right">On invested</Th>
            </tr>
          </thead>
          <tbody>
            {waterfall.series.map((s, i) => {
              const round = rounds.find((r) => r.id === s.id);
              return (
                <tr key={s.id} className="border-b border-line">
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Swatch color={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      <span className="font-medium">{s.name}</span>
                      {round?.projected ? (
                        <span className="rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
                          projected
                        </span>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="text-[13px] text-fg-muted">
                    {s.converted ? (
                      <span style={{ color: "var(--pos)" }}>Converted to common</span>
                    ) : s.cappedOut ? (
                      <span style={{ color: "var(--warn)" }}>Participation capped</span>
                    ) : round?.participating ? (
                      "Preference + participation"
                    ) : (
                      "Liquidation preference"
                    )}
                  </Td>
                  <Td className="text-right tnum font-medium">{money(s.total)}</Td>
                  <Td className="text-right tnum text-fg-muted">
                    {multiple(s.multipleOnInvested)}
                  </Td>
                </tr>
              );
            })}

            <tr className="border-b border-line">
              <Td>
                <span className="flex items-center gap-2.5">
                  <Swatch color={COMMON_COLOR} />
                  <span className="font-medium">Common + pool</span>
                </span>
              </Td>
              <Td className="text-[13px] text-fg-muted">
                {pricePerShare(waterfall.commonPricePerShare)} per share
              </Td>
              <Td className="text-right tnum font-medium">
                {money(waterfall.commonPool)}
              </Td>
              <Td className="text-right tnum text-fg-subtle">—</Td>
            </tr>

            <tr>
              <Td>
                <span className="flex items-center gap-2.5">
                  <Swatch color={YOU_COLOR} />
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>
                    You
                  </span>
                </span>
              </Td>
              <Td className="text-[13px] text-fg-muted">
                {percent(outcome.ownershipFraction, 3)} fully diluted
              </Td>
              <Td
                className="text-right tnum font-semibold"
                style={{ color: "var(--accent)" }}
              >
                {money(outcome.gross)}
              </Td>
              <Td className="text-right tnum text-fg-subtle">—</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-fg-muted">
      <Swatch color={color} />
      {label}
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`pb-2.5 text-[13px] font-medium text-fg-subtle ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td className={`py-3 align-middle text-[14px] ${className}`} style={style}>
      {children}
    </td>
  );
}
