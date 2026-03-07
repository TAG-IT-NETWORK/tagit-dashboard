import type { Metadata } from "next";
import { Inter, Syne, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "TAG IT Verify - Product Authenticity",
  description:
    "Verify product authenticity on-chain. Tap an NFC tag to check lifecycle state on Arbitrum.",
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
