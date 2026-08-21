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

  const title = `${scenario.capTable.companyName} — Waterline`;
  const description = `What ${scenario.grant.shares.toLocaleString(
    "en-US",
  )} options at ${scenario.capTable.companyName} are actually worth, after liquidation preferences.`;

  return {
    title,
    description,
    // A shared cap table is nobody else's business to index.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Waterline",
      url: `/s/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
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
