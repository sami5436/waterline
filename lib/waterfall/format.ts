/** Compact money for headline figures: $1.2M, $840K, $3.5B. */
export function money(value: number, opts: { sign?: boolean } = {}): string {
  const sign = value < 0 ? "-" : opts.sign && value > 0 ? "+" : "";
  const n = Math.abs(value);

  if (n < 1000) return `${sign}$${n.toFixed(0)}`;
  if (n < 1_000_000) return `${sign}$${trim(n / 1000)}K`;
  if (n < 1_000_000_000) return `${sign}$${trim(n / 1_000_000)}M`;
  return `${sign}$${trim(n / 1_000_000_000)}B`;
}

/** Full precision with separators: $1,234,567. */
export function dollars(value: number, fractionDigits = 0): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Per-share prices need more precision than headline dollars. */
export function pricePerShare(value: number): string {
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
  if (Math.abs(value) < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

export function shares(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function percent(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function multiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

function trim(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/** Parses "1.5m", "$250k", "2b", "1,000" into a number. Returns null on junk. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;

  const match = /^(-?\d*\.?\d+)([kmb])?$/.exec(cleaned);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2] ?? ""] ?? 1;
  return base * scale;
}
