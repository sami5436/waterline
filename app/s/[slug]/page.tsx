import { notFound } from "next/navigation";

import { shareScenario } from "@/app/actions";
import { WaterlineApp } from "@/components/waterline-app";
import { isDatabaseConfigured } from "@/lib/db";
import { loadScenario } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const scenario = await loadScenario(slug);
  if (!scenario) return { title: "Scenario not found — Waterline" };

  return {
    title: `${scenario.capTable.companyName} — Waterline`,
    description: `What ${scenario.grant.shares.toLocaleString(
      "en-US",
    )} options at ${scenario.capTable.companyName} are actually worth, after liquidation preferences.`,
    // A shared cap table is nobody else's business to index.
    robots: { index: false, follow: false },
  };
}

export default async function SharedScenario({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const scenario = await loadScenario(slug);
  if (!scenario) notFound();

  return (
    <WaterlineApp
      initialScenario={scenario}
      saveAction={isDatabaseConfigured() ? shareScenario : undefined}
      startsDetailed
    />
  );
}
