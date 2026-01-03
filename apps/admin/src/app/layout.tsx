import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";
import { AdminShell } from "@/components/admin-shell";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TAG IT Admin",
  description: "Internal dashboard for TAG IT Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AppProviders>
          <AdminShell>{children}</AdminShell>
        </AppProviders>
      </body>
    </html>
  );
}
