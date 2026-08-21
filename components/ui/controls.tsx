"use client";

import { useEffect, useId, useState } from "react";
import { compact, parseMoney } from "@/lib/waterfall/format";

/* ------------------------------------------------------------------ */
/* Card chrome                                                         */
/* ------------------------------------------------------------------ */

export function Card({
  title,
  aside,
  children,
  className = "",
  bodyClassName = "p-5 sm:p-6",
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-card shadow-[var(--shadow-card)] ${className}`}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {aside}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-[12.5px] leading-snug text-fg-subtle">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

/** Small right-aligned figure that sits in a card header. */
export function CardMeta({ children }: { children: React.ReactNode }) {
  return <span className="tnum text-[13px] text-fg-subtle">{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full h-10 rounded-lg border border-line bg-card px-3 " +
  "text-[15px] tnum text-fg placeholder:text-fg-subtle " +
  "hover:border-line-strong focus:border-accent focus:outline-none " +
  "focus:ring-4 focus:ring-[var(--accent-ring)] transition-[border-color,box-shadow]";

/**
 * A text field that accepts shorthand money ("250k", "$1.2m", "2b") and holds
 * the raw keystrokes while focused so typing never fights the formatter.
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  prefix,
  suffix,
  format = "plain",
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  format?: "plain" | "grouped" | "compact";
  ariaLabel?: string;
}) {
  const display = (n: number) => {
    if (format === "grouped") return Math.round(n).toLocaleString("en-US");
    if (format === "compact") return compact(n);
    return String(round6(n));
  };

  const [draft, setDraft] = useState(() => display(value));
  const [focused, setFocused] = useState(false);

  // Adopt external changes (preset switch, share link load) unless the user is
  // actively typing in this field.
  useEffect(() => {
    if (!focused) setDraft(display(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, format]);

  const commit = (text: string) => {
    const parsed = parseMoney(text);
    if (parsed === null) {
      setDraft(display(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setDraft(display(clamped));
  };

  return (
    <div className="relative flex items-center">
      {prefix ? (
        <span className="pointer-events-none absolute left-3 text-[15px] text-fg-subtle">
          {prefix}
        </span>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={inputClass}
        style={{
          paddingLeft: prefix ? "1.75rem" : undefined,
          paddingRight: suffix ? "2.5rem" : undefined,
        }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(display(value));
            e.currentTarget.blur();
          }
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 text-[13px] text-fg-subtle">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function TextInput({
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      className={`${inputClass} font-medium ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 60))}
    />
  );
}

export function DateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      type="date"
      aria-label={ariaLabel}
      className={inputClass}
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-lg border border-line bg-muted p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-card text-fg shadow-[var(--shadow-card)]"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-accent bg-accent" : "border-line-strong bg-muted"
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer select-none leading-tight">
        <span className="block text-[14px] font-medium text-fg">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-subtle">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
  ariaValueText,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  ariaValueText?: string;
}) {
  return (
    <input
      type="range"
      className="w-full"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "secondary" | "primary" | "quiet";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const base =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 " +
    "text-[13.5px] font-medium whitespace-nowrap transition-colors " +
    "disabled:opacity-45 disabled:cursor-not-allowed";

  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary:
      "border border-line bg-card text-fg hover:border-line-strong hover:bg-muted",
    quiet: "text-fg-muted hover:bg-muted hover:text-fg",
  }[variant];

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
