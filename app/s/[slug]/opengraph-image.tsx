import { computeVerdict } from "@/lib/waterfall/engine";
import { money, shares } from "@/lib/waterfall/format";
import { loadScenario } from "@/lib/scenarios";
import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A shared equity scenario on Waterline";

/**
 * The preview card for a shared link carries the actual finding, so the
 * headline number shows up in the message thread without anyone opening it.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scenario = await loadScenario(slug);

  if (!scenario) {
    return renderOgImage({
      marker: "Waterline",
      headline: "This scenario",
      emphasis: "is no longer here",
      sub: "The link may have expired. Build your own at waterline-azure.vercel.app.",
    });
  }

  const verdict = computeVerdict(scenario);
  const company = scenario.capTable.companyName;
  const grant = shares(scenario.grant.shares);

  // How far along the strip the waterline sits, relative to the valuation the
  // company itself quotes.
  const submerged =
    verdict.waterline !== null && verdict.lastPostMoney > 0
      ? verdict.waterline / (verdict.lastPostMoney * 2)
      : 0.34;

  return renderOgImage({
    marker: company,
    headline: `${grant} options quoted at ${money(verdict.headlineValue)}.`,
    emphasis:
      verdict.waterline === null
        ? "Worth nothing at any price."
        : `Worth nothing below ${money(verdict.waterline)}.`,
    sub: `${company} is valued at ${money(
      verdict.lastPostMoney,
    )} today, with ${money(verdict.preferenceOverhang)} of liquidation preference paid out before common stock sees a dollar.`,
    submerged,
  });
}
