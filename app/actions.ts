"use server";

import { saveScenario, type SaveResult } from "@/lib/scenarios";
import type { Scenario } from "@/lib/waterfall/types";

/**
 * The one server action the client can reach: persist a scenario and return
 * its permalink slug. The payload is re-validated server-side, so a crafted
 * request can only ever store a well-formed scenario.
 */
export async function shareScenario(scenario: Scenario): Promise<SaveResult> {
  return saveScenario(scenario);
}
