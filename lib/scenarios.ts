import "server-only";
import { customAlphabet } from "nanoid";
import { sql } from "./db";
import { normalizeScenario } from "./waterfall/schema";
import type { Scenario } from "./waterfall/types";

/**
 * Lowercase alphanumerics minus the characters people misread aloud (0/o,
 * 1/l/i). Ten of these is ~52 bits, which is far more than enough to make
 * slugs unguessable while staying short enough to paste into Slack.
 */
const newSlug = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

export interface SaveResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

/**
 * Persists a scenario and returns its permalink slug. The payload is
 * normalized on the way in so nothing but a well-formed scenario is ever
 * stored, and again on the way out so an older stored shape still renders.
 */
export async function saveScenario(input: unknown): Promise<SaveResult> {
  const db = sql();
  if (!db) return { ok: false, error: "Sharing is not configured." };

  const scenario = normalizeScenario(input);
  const title = scenario.capTable.companyName.slice(0, 60);

  // Slug collisions are vanishingly unlikely, but a retry is cheap insurance
  // against silently overwriting somebody else's scenario.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newSlug();
    try {
      const rows = await db`
        INSERT INTO scenarios (slug, title, payload)
        VALUES (${slug}, ${title}, ${JSON.stringify(scenario)}::jsonb)
        ON CONFLICT (slug) DO NOTHING
        RETURNING slug
      `;
      if (rows.length > 0) return { ok: true, slug };
    } catch (error) {
      console.error("saveScenario failed", error);
      return { ok: false, error: "Could not save this scenario." };
    }
  }

  return { ok: false, error: "Could not allocate a link. Try again." };
}

/** Loads a shared scenario, or null when the slug is unknown. */
export async function loadScenario(slug: string): Promise<Scenario | null> {
  const db = sql();
  if (!db) return null;
  if (!/^[a-z0-9]{4,32}$/.test(slug)) return null;

  try {
    const rows = await db`
      UPDATE scenarios
         SET views = views + 1,
             last_viewed = now()
       WHERE slug = ${slug}
      RETURNING payload
    `;
    if (rows.length === 0) return null;
    return normalizeScenario(rows[0].payload);
  } catch (error) {
    console.error("loadScenario failed", error);
    return null;
  }
}
