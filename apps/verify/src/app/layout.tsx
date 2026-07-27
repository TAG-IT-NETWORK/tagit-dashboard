import type { Metadata } from "next";
import { Inter, Syne, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";
import { SITE_ORIGIN } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  /**
   * Makes the per-asset canonical tags ABSOLUTE and pinned to this origin.
   *
   * app/asset/[tokenId]/page.tsx sets `alternates: { canonical: "/asset/50" }`,
   * and Next resolves relative metadata URLs against `metadataBase`.
   *
   * MEASURED, not assumed — Next 14.2.35, production build, curl'd both ways:
   *   without metadataBase → <link rel="canonical" href="/asset/50"/>
   *   with    metadataBase → <link rel="canonical"
   *                            href="https://verify.tagit.network/asset/50"/>
   * (Setting VERCEL_URL changed nothing; the fallback is a relative href, not
   * an absolute localhost/vercel one. Do not repeat that guess.)
   *
   * So the "before" state was not broken — a relative canonical is legal and
   * resolves against the serving document. What it cannot do is name an origin.
   * It self-canonicalises to WHATEVER HOST SERVED THE RESPONSE, so every origin
   * this app is reachable on — the raw *.vercel.app production hostname, a
   * preview deployment, any proxy or mirror — declares itself canonical, and
   * those duplicates never consolidate onto verify.tagit.network. An absolute
   * canonical collapses all of them onto the one origin, which is the entire
   * job of the tag and is why Google's docs recommend the absolute form.
   *
   * This also becomes the base for any future openGraph/twitter image URLs,
   * which must be absolute to be fetchable by a crawler at all.
   *
   * Deliberately NO `alternates.canonical` here. Metadata is inherited by child
   * segments, so a canonical set at the layout would be adopted by every page
   * that does not override it — /sun and /tag/{uid} would each claim to be the
   * home page. Canonicals belong on the individual routes.
   */
  metadataBase: new URL(SITE_ORIGIN),
  title: "TAG IT Verify - Product Authenticity",
  description:
    "Verify product authenticity on-chain. Tap an NFC tag to check lifecycle state on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ background: "#000000" }}>
      <body
        className={`${inter.variable} ${syne.variable} ${jetbrainsMono.variable} font-sans`}
        style={{ background: "#000000", color: "#ffffff" }}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
