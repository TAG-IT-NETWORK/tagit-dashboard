import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TAG IT Business",
  description: "Prove your products are real. Manage your verified products in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="motion-safe:scroll-smooth">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
