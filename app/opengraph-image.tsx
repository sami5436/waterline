import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt =
  "Waterline — what your startup equity is actually worth, after liquidation preferences";

export default async function Image() {
  return renderOgImage({
    marker: "Waterline",
    headline: "What your startup equity",
    emphasis: "is actually worth",
    sub: "Investors get paid before you do. Find the price your company has to sell for before your options are worth anything at all.",
    submerged: 0.34,
  });
}
