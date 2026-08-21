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

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Waterline",
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Waterline",
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
