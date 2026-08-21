"use client";

import type { CapTable, Round } from "@/lib/waterfall/types";
import {
  money,
  percent,
  pricePerShare,
  shares as fmtShares,
} from "@/lib/waterfall/format";
import { fullyDilutedShares, preferenceOverhang } from "@/lib/waterfall/engine";
import {
  Button,
  Panel,
  CardMeta,
  Field,
  NumberInput,
  TextInput,
  Toggle,
} from "./ui/controls";

export function CapTableEditor({
  capTable,
  onChange,
}: {
  capTable: CapTable;
  onChange: (next: CapTable) => void;
}) {
  const fd = fullyDilutedShares(capTable);
  const overhang = preferenceOverhang(capTable);

  const patch = (partial: Partial<CapTable>) => onChange({ ...capTable, ...partial });

  const patchRound = (id: string, partial: Partial<Round>) =>
    patch({
      rounds: capTable.rounds.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    });

  const addRound = () => {
    // A new round goes in last chronologically and, as stacked preference works
    // in practice, first in line to be paid — so everything already on the table
    // drops one tier more junior.
    patch({
      rounds: [
        ...capTable.rounds.map((r) => ({ ...r, seniority: r.seniority + 1 })),
        {
          id: `r${Date.now().toString(36)}`,
          name: nextRoundName(capTable.rounds),
          invested: 10_000_000,
          shares: 2_000_000,
          prefMultiple: 1,
          participating: false,
          participationCap: null,
          seniority: 0,
          projected: false,
        },
      ],
    });
  };

  const removeRound = (id: string) =>
    patch({ rounds: capTable.rounds.filter((r) => r.id !== id) });

  return (
    <Panel
      title="The cap table"
      aside={<CardMeta>{fmtShares(fd)} fully diluted</CardMeta>}
    >
      <div className="space-y-5">
        <Field label="Company">
          <TextInput
            value={capTable.companyName}
            onChange={(companyName) => patch({ companyName })}
            ariaLabel="Company name"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
          <Field label="Common shares" hint="Founders and exercised options.">
            <NumberInput
              value={capTable.commonShares}
              onChange={(commonShares) => patch({ commonShares })}
              format="grouped"
              ariaLabel="Common shares outstanding"
            />
          </Field>
          <Field label="Option pool" hint="Granted and ungranted.">
            <NumberInput
              value={capTable.optionPoolShares}
              onChange={(optionPoolShares) => patch({ optionPoolShares })}
              format="grouped"
              ariaLabel="Option pool shares"
            />
          </Field>
        </div>

        <div className="border-t border-line pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium text-fg">Preferred rounds</div>
              <div className="text-[13px] text-fg-subtle">
                {money(overhang)} stacked ahead of you
              </div>
            </div>
            <Button onClick={addRound} disabled={capTable.rounds.length >= 12}>
              Add round
            </Button>
          </div>

          <div className="space-y-4">
            {capTable.rounds.length === 0 ? (
              <p className="border border-line bg-page px-4 py-5 text-center text-[13.5px] text-fg-muted">
                No preferred stock. Every share splits the exit evenly.
              </p>
            ) : (
              capTable.rounds.map((round, i) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  index={i}
                  fullyDiluted={fd}
                  onChange={(partial) => patchRound(round.id, partial)}
                  onRemove={() => removeRound(round.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function RoundCard({
  round,
  index,
  fullyDiluted,
  onChange,
  onRemove,
}: {
  round: Round;
  index: number;
  fullyDiluted: number;
  onChange: (partial: Partial<Round>) => void;
  onRemove: () => void;
}) {
  const price = round.shares > 0 ? round.invested / round.shares : 0;
  const ownership = fullyDiluted > 0 ? round.shares / fullyDiluted : 0;

  return (
    <div className="border border-line bg-page p-4">
      <div className="mb-4 flex items-center gap-2">
        <TextInput
          value={round.name}
          onChange={(name) => onChange({ name })}
          ariaLabel={`Round ${index + 1} name`}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${round.name}`}
          title={`Remove ${round.name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] text-fg-subtle transition-colors hover:bg-card hover:text-[color:var(--neg)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
        <Field label="Raised">
          <NumberInput
            value={round.invested}
            onChange={(invested) => onChange({ invested })}
            prefix="$"
            format="compact"
            ariaLabel={`${round.name} amount raised`}
          />
        </Field>
        <Field label="Shares issued">
          <NumberInput
            value={round.shares}
            onChange={(shares) => onChange({ shares })}
            format="grouped"
            ariaLabel={`${round.name} shares issued`}
          />
        </Field>
        <Field label="Preference">
          <NumberInput
            value={round.prefMultiple}
            onChange={(prefMultiple) => onChange({ prefMultiple })}
            min={0}
            max={10}
            suffix="×"
            ariaLabel={`${round.name} liquidation preference multiple`}
          />
        </Field>
        <Field label="Seniority" hint="0 is paid first. Ties are pari passu.">
          <NumberInput
            value={round.seniority}
            onChange={(seniority) => onChange({ seniority: Math.round(seniority) })}
            min={0}
            max={12}
            ariaLabel={`${round.name} seniority tier`}
          />
        </Field>
      </div>

      <div className="mt-4 space-y-3.5 border-t border-line pt-4">
        <Toggle
          checked={round.participating}
          onChange={(participating) =>
            onChange({
              participating,
              participationCap: participating ? round.participationCap : null,
            })
          }
          label="Participating"
          hint="Takes the preference and then shares the residual too."
        />

        {round.participating ? (
          <div className="flex flex-wrap items-center gap-3 pl-12">
            <Toggle
              checked={round.participationCap !== null}
              onChange={(on) => onChange({ participationCap: on ? 3 : null })}
              label="Capped at"
            />
            {round.participationCap !== null ? (
              <div className="w-24">
                <NumberInput
                  value={round.participationCap}
                  onChange={(participationCap) => onChange({ participationCap })}
                  min={0}
                  max={100}
                  suffix="×"
                  ariaLabel={`${round.name} participation cap`}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <Toggle
          checked={round.projected === true}
          onChange={(projected) => onChange({ projected })}
          label="Projected"
          hint="A round you expect, not one that has closed."
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[13px] text-fg-subtle">
        <span className="tnum">{pricePerShare(price)}/share</span>
        <span className="tnum">{percent(ownership, 1)} of the company</span>
        <span className="tnum">
          {money(round.invested * round.prefMultiple)} preference
        </span>
      </div>
    </div>
  );
}

const LADDER = [
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series F",
];

function nextRoundName(rounds: Round[]): string {
  const used = new Set(rounds.map((r) => r.name));
  return LADDER.find((name) => !used.has(name)) ?? `Round ${rounds.length + 1}`;
}
