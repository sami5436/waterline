"use client";

import { useMemo, useState } from "react";
import type { CurvePoint, Verdict } from "@/lib/waterfall/types";
import { money } from "@/lib/waterfall/format";
import { useMeasure } from "./use-measure";

export function ExitChart({
  curve,
  verdict,
  exitValue,
  netAtExit,
  onScrub,
}: {
  curve: CurvePoint[];
  verdict: Verdict;
  exitValue: number;
  netAtExit: number;
  onScrub: (exit: number) => void;
}) {
  const [box, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<CurvePoint | null>(null);

  const narrow = width > 0 && width < 560;
  const margin = {
    top: 18,
    right: narrow ? 10 : 16,
    bottom: narrow ? 28 : 32,
    left: narrow ? 46 : 62,
  };
  const height = narrow ? 240 : 340;
  const plotW = Math.max(1, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;

  const maxExit = curve.length ? curve[curve.length - 1].exit : 1;
  const peak = curve.reduce((m, p) => Math.max(m, p.net), 0);
  const yMax = niceCeil(peak || 1);

  const x = (v: number) => (v / maxExit) * plotW;
  const y = (v: number) => plotH - (v / yMax) * plotH;

  const geometry = useMemo(() => {
    if (!curve.length || plotW <= 1) return { line: "", area: "" };
    const pts = curve.map((p) => `${x(p.exit).toFixed(2)},${y(p.net).toFixed(2)}`);
    return {
      line: `M${pts.join("L")}`,
      area: `M${x(0)},${y(0)}L${pts.join("L")}L${x(maxExit).toFixed(2)},${y(0)}Z`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, plotW, plotH, yMax, maxExit]);

  const xTicks = useMemo(() => ticks(maxExit, narrow ? 3 : 5), [maxExit, narrow]);
  const yTicks = useMemo(() => ticks(yMax, narrow ? 3 : 4), [yMax, narrow]);

  const waterlineX =
    verdict.waterline !== null && verdict.waterline <= maxExit
      ? x(verdict.waterline)
      : null;

  const overhangX =
    verdict.preferenceOverhang > 0 && verdict.preferenceOverhang <= maxExit
      ? x(verdict.preferenceOverhang)
      : null;

  const pointFromClientX = (clientX: number, rect: DOMRect): CurvePoint | null => {
    if (!curve.length) return null;
    const px = clientX - rect.left - margin.left;
    const value = clamp((px / plotW) * maxExit, 0, maxExit);
    let best = curve[0];
    for (const p of curve) {
      if (Math.abs(p.exit - value) < Math.abs(best.exit - value)) best = p;
    }
    return best;
  };

  const readout = hover ?? ({ exit: exitValue, net: netAtExit } as CurvePoint);
  const tickSize = 12;

  return (
    <div className="w-full">
      {/* Readout sits in the DOM, not the SVG, so it stays selectable and
          wraps sanely on a phone. */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[13px] font-medium text-fg-muted">
          Your net proceeds
        </span>
        <span className="tnum text-[13px] text-fg-subtle">
          {money(readout.exit)} exit
          <span className="mx-1.5">→</span>
          <span
            className="font-semibold"
            style={{ color: readout.net > 0 ? "var(--pos)" : "var(--neg)" }}
          >
            {money(readout.net)}
          </span>
        </span>
      </div>

      <div ref={box} className="w-full select-none">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Payout curve. Your net proceeds stay at zero until an exit of ${
              verdict.waterline === null
                ? "beyond the charted range"
                : money(verdict.waterline)
            }, then rise to ${money(peak)} at a ${money(maxExit)} exit.`}
            className="touch-none"
            onPointerMove={(e) =>
              setHover(
                pointFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()),
              )
            }
            onPointerLeave={() => setHover(null)}
            onPointerDown={(e) => {
              const p = pointFromClientX(
                e.clientX,
                e.currentTarget.getBoundingClientRect(),
              );
              if (p) onScrub(p.exit);
            }}
          >
            <defs>
              <linearGradient id="wl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--curve-top)" }} />
                <stop offset="100%" style={{ stopColor: "var(--curve-bottom)" }} />
              </linearGradient>
              <linearGradient id="wl-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--water-top)" }} />
                <stop offset="100%" style={{ stopColor: "var(--water-bottom)" }} />
              </linearGradient>
            </defs>

            <g transform={`translate(${margin.left},${margin.top})`}>
              {/* The submerged column: every exit that leaves you with nothing. */}
              {waterlineX !== null && waterlineX > 0 ? (
                <g>
                  <rect
                    x={0}
                    y={0}
                    width={waterlineX}
                    height={plotH}
                    rx={3}
                    fill="url(#wl-water)"
                  />
                  <line
                    x1={waterlineX}
                    y1={0}
                    x2={waterlineX}
                    y2={plotH}
                    style={{ stroke: "var(--neg)" }}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  {waterlineX > 74 ? (
                    <text
                      x={waterlineX - 8}
                      y={12}
                      textAnchor="end"
                      fontSize={12}
                      fontWeight={600}
                      style={{ fill: "var(--neg)" }}
                    >
                      Waterline
                    </text>
                  ) : null}
                </g>
              ) : null}

              {/* Where common stock first sees a dollar, whatever your strike. */}
              {overhangX !== null && overhangX > 2 ? (
                <line
                  x1={overhangX}
                  y1={0}
                  x2={overhangX}
                  y2={plotH}
                  style={{ stroke: "var(--fg-subtle)" }}
                  strokeWidth={1}
                  strokeDasharray="2 5"
                  opacity={0.6}
                />
              ) : null}

              {yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line
                    x1={0}
                    y1={y(t)}
                    x2={plotW}
                    y2={y(t)}
                    style={{ stroke: "var(--grid)" }}
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={y(t) + 4}
                    textAnchor="end"
                    fontSize={tickSize}
                    style={{ fill: "var(--fg-subtle)" }}
                  >
                    {t === 0 ? "$0" : money(t)}
                  </text>
                </g>
              ))}

              {xTicks.map((t) => (
                <text
                  key={`x${t}`}
                  x={x(t)}
                  y={plotH + 19}
                  textAnchor={t === 0 ? "start" : t >= maxExit ? "end" : "middle"}
                  fontSize={tickSize}
                  style={{ fill: "var(--fg-subtle)" }}
                >
                  {money(t)}
                </text>
              ))}

              <path d={geometry.area} fill="url(#wl-fill)" />
              <path
                d={geometry.line}
                fill="none"
                style={{ stroke: "var(--pos)" }}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Where the slider currently sits. */}
              <line
                x1={x(exitValue)}
                y1={0}
                x2={x(exitValue)}
                y2={plotH}
                style={{ stroke: "var(--accent)" }}
                strokeWidth={1.5}
                opacity={0.5}
              />
              <circle
                cx={x(exitValue)}
                cy={y(netAtExit)}
                r={5}
                style={{ fill: "var(--plot-dot)", stroke: "var(--accent)" }}
                strokeWidth={2.5}
              />

              {hover ? (
                <g pointerEvents="none">
                  <line
                    x1={x(hover.exit)}
                    y1={0}
                    x2={x(hover.exit)}
                    y2={plotH}
                    style={{ stroke: "var(--fg)" }}
                    strokeWidth={1}
                    opacity={0.25}
                  />
                  <circle
                    cx={x(hover.exit)}
                    cy={y(hover.net)}
                    r={3.5}
                    style={{ fill: "var(--fg)" }}
                  />
                </g>
              ) : null}
            </g>
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Rounds up to 1, 2, 2.5 or 5 times a power of ten. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const pow = 10 ** exp;
  const frac = value / pow;
  const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return step * pow;
}

/** Evenly spaced ticks from 0 to max on a round interval. */
function ticks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const rawStep = max / count;
  const exp = Math.floor(Math.log10(rawStep));
  const pow = 10 ** exp;
  const frac = rawStep / pow;
  const step =
    (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * pow;

  const out: number[] = [];
  for (let v = 0; v <= max + step * 1e-6; v += step) out.push(round(v));
  return out;
}

function round(v: number) {
  return Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(12));
}
