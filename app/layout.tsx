import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { ThemeProvider, themeBootScript } from "@/components/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Narrow, high-contrast serif. Carries the big money figures.
const displaySerif = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const title = "Waterline — what your startup equity is actually worth";
const description =
  "Your offer letter quotes a number. Liquidation preferences, participation rights and dilution decide the real one. Waterline models the full exit waterfall and finds the exit price below which your common stock pays you nothing.";

/**
 * Absolute base for og:image and og:url. iMessage, Slack and friends all
 * require absolute URLs, and relative ones only become absolute if this is set.
 */
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Waterline",
  keywords: [
    "startup equity",
    "stock options",
    "liquidation preference",
    "cap table",
    "exit waterfall",
    "ISO",
    "RSU",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Waterline",
    locale: "en_US",
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      // The boot script rewrites data-theme before React hydrates, which is
      // exactly the kind of pre-hydration DOM edit this suppresses.
      suppressHydrationWarning
      className={`${inter.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint, so returning dark-mode
            visitors never get a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
