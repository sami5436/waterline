# Waterline

**What your startup equity is actually worth.**

**[waterline-azure.vercel.app](https://waterline-azure.vercel.app)**

Your offer letter quotes a number: shares × the last round's price per share. That number is almost always wrong, and usually wrong in one direction.

Liquidation preferences mean investors are paid first — often a multiple of what they put in, sometimes with the right to take their preference *and* their pro-rata share of what's left. Until that stack is paid, common stock receives nothing. So there is an exit price below which your options are worth exactly zero, and it is frequently far above the valuation the company quotes.

Waterline finds that price.

## What it computes

Given a cap table and a grant, at every possible exit value:

1. **Liquidation preferences** are paid in seniority tiers. Rounds sharing a seniority number are pari passu and pro-rate against each other when funds run short; junior tiers get nothing.
2. **The residual** is split pro-rata across common, the option pool, converted preferred, and any participating preferred. Participation caps are honoured by paying capped holders their remaining headroom and removing them — which raises the per-share rate for everyone still in, so the loop repeats until no cap binds.
3. **Conversion decisions** are the interesting part. Non-participating preferred takes the greater of its preference and its as-converted share. Capped participating preferred converts once as-converted beats the cap. But each holder's choice changes the residual, and therefore everyone else's choice. The stable outcome is a Nash equilibrium over `n` binary decisions; best-response iteration finds it, with exhaustive search as a fallback if a structure cycles.

Then, for you specifically: month-accurate vesting with cliffs, a dilution haircut, exercise cost, and tax under two strategies — cashless exercise at the exit (the whole spread is ordinary income, since a same-day ISO sale is a disqualifying disposition) or early exercise (long-term rates at exit, with the ISO bargain element surfaced separately as an AMT estimate rather than quietly netted out, because it's cash you owe years before any exit).

The headline output is the **waterline**: the lowest exit value at which your grant nets more than zero, found by bisection.

## The numbers you need

The ones that decide the answer are not in your offer letter. They're in the certificate of incorporation and the stock purchase agreement:

| You need | Why it matters |
|---|---|
| Amount raised per round | Sets the size of the preference stack |
| Preference multiple | 1× is normal; 2× doubles what's paid ahead of you |
| Participating? Capped? | Participating preferred takes its money *and* a share of the rest |
| Seniority | Whether later rounds are paid before earlier ones, or alongside them |
| Shares issued per round | Determines conversion economics and your real ownership |
| Fully diluted share count | The denominator on your ownership |

Ask for them. A company that won't share its preference structure with an employee holding options has told you something.

## Two views

It opens as a **simple calculator**: five numbers you can actually find — options and strike from your offer letter, valuation and total raised from a news story, and a share count — and one answer back. That view assumes the standard deal (a 1x non-participating preference) and full vesting.

The **full model** is behind one link. It takes each round separately, with its own preference multiple, participation rights, cap and seniority tier, plus your real vesting schedule and tax treatment. That is where you go once you've asked for the actual terms — and where the number usually gets worse.

## Running it

```bash
npm install
npm run dev
```

Opens on `http://localhost:3000`. The database is optional — without `DATABASE_URL` the app works completely, minus the Share button.

```bash
npm test        # engine + normaliser, no dependencies beyond node:test
npm run typecheck
npm run build
```

### Sharing

Set `DATABASE_URL` to a Postgres connection string and create:

```sql
CREATE TABLE scenarios (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Untitled scenario',
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed TIMESTAMPTZ NOT NULL DEFAULT now(),
  views       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX scenarios_created_at_idx ON scenarios (created_at DESC);
```

Scenarios are stored only when Share is pressed. Shared pages are `noindex, nofollow` and open on the full model.

Without `DATABASE_URL` the Share button is not rendered and `/s/<slug>` returns 404 — nothing else changes.

## Layout

```
lib/waterfall/
  engine.ts     the waterfall, vesting, tax, and the waterline bisection
  types.ts      cap table, grant, tax assumptions, engine output
  schema.ts     coerces untrusted JSON into a scenario the engine can run
  presets.ts    three example cap tables
  format.ts     money, share and per-share formatting
lib/
  db.ts         lazily-resolved Neon client; null when unconfigured
  scenarios.ts  save and load (server-only)
components/     the interface
app/            routes and the one server action
```

## Testing

43 tests, no test framework — just `node:test` and native TypeScript stripping.

Each preference structure is checked against payouts computed by hand: non-participating flipping at its indifference point, participating double-dipping, caps binding and then giving way to conversion, senior series wiping out junior ones, pari passu pro-rating. On a three-round stack there are three invariants that would catch almost any algebra slip:

- **conservation** — payouts sum to the exit value at every tested exit
- **monotonicity** — price per share never falls as the exit grows, across 120 sampled exits
- **no holder left behind** — no series is ever paid less than converting would have given it

## Accuracy

The waterfall mechanics are modelled properly. The tax treatment is deliberately simplified: flat rates, ignoring brackets, the AMT exemption and its phase-out, QSBS, state-by-state treatment, and the holding periods that decide whether a sale qualifies for long-term rates. It's built for comparing scenarios, not for filing.

Not modelled: management carve-outs, escrow and holdback, earnouts, convertible notes and SAFEs prior to conversion, anti-dilution ratchets adjusting conversion ratios, and secondary sales. Any of these can move the answer.

**Waterline is a modelling tool, not financial, legal or tax advice.**

## Licence

MIT
