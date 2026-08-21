import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const PAPER = "#f7f2e9";
const INK = "#1c1714";
const MUTED = "#5d5147";
const SUBTLE = "#8c7d6d";
const RED = "#b23a25";
const SEA = "#0e4b5c";

/**
 * Loaded from the repo rather than fetched, so image generation can't fail
 * because a font CDN is slow. `outputFileTracingIncludes` in next.config.ts
 * keeps the file in the serverless bundle.
 */
async function loadSerif(): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(
      join(process.cwd(), "assets", "InstrumentSerif-Regular.ttf"),
    );
    return Uint8Array.from(buf).buffer;
  } catch {
    // Falls back to next/og's built-in face. A plainer card beats no card.
    return null;
  }
}

export interface OgContent {
  /** Small letterspaced label along the top. */
  marker: string;
  /** The headline, in the display serif. */
  headline: string;
  /** Emphasised second clause, set in red. Optional. */
  emphasis?: string;
  /** Supporting sentence beneath. */
  sub: string;
  /** How much of the waterline strip is underwater, 0–1. */
  submerged?: number;
}

export async function renderOgImage(content: OgContent) {
  const serif = await loadSerif();
  const submerged = Math.min(0.85, Math.max(0.12, content.submerged ?? 0.34));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "64px 72px",
          fontFamily: "Display",
        }}
      >
        {/* Masthead */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: SUBTLE,
            }}
          >
            {content.marker}
          </div>
          <div
            style={{
              marginTop: 16,
              width: "100%",
              height: 3,
              background: INK,
              display: "flex",
            }}
          />
        </div>

        {/* The finding */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 74,
              lineHeight: 1.08,
              color: INK,
              letterSpacing: -1,
            }}
          >
            {content.headline}
          </div>
          {content.emphasis ? (
            <div
              style={{
                display: "flex",
                fontSize: 74,
                lineHeight: 1.08,
                color: RED,
                letterSpacing: -1,
              }}
            >
              {content.emphasis}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 28,
              lineHeight: 1.4,
              color: MUTED,
              maxWidth: 900,
            }}
          >
            {content.sub}
          </div>
        </div>

        {/* The waterline itself, as a strip */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 56 }}>
            <div
              style={{
                display: "flex",
                width: `${submerged * 100}%`,
                height: "100%",
                background: SEA,
                opacity: 0.22,
              }}
            />
            <div style={{ display: "flex", width: 4, height: "100%", background: RED }} />
            <div style={{ display: "flex", flexGrow: 1, height: "100%" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 14,
              fontSize: 22,
              color: SUBTLE,
            }}
          >
            <span>Underwater — your options pay nothing</span>
            <span>waterline-azure.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: serif
        ? [{ name: "Display", data: serif, style: "normal", weight: 400 }]
        : [],
    },
  );
}
