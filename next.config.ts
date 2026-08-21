import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No floating Next.js badge over the app while developing.
  devIndicators: false,

  // The OG font is read from disk at request time; the tracer can't see a
  // runtime path, so name it explicitly or the card renders in a fallback face.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/**"],
    "/twitter-image": ["./assets/**"],
    "/s/[slug]/opengraph-image": ["./assets/**"],
  },
};

export default nextConfig;
