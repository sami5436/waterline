import { shareScenario } from "@/app/actions";
import { WaterlineApp } from "@/components/waterline-app";
import { isDatabaseConfigured } from "@/lib/db";
import { defaultScenario, todayISO, withAsOf } from "@/lib/waterfall/presets";

// Rendered at request time so vesting is evaluated as of today rather than
// whenever this was last deployed.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <WaterlineApp
      initialScenario={withAsOf(defaultScenario, todayISO())}
      saveAction={isDatabaseConfigured() ? shareScenario : undefined}
    />
  );
}
