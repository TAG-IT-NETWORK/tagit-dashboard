import type { Metadata } from "next";
import { getTenant } from "@/lib/actor";
import { Inter } from "next/font/google";
import { ClientShell } from "./client-shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TAG IT Admin",
  description: "Internal dashboard for TAG IT Network",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tenant-scoped (brand) sessions get the operations menu only; see Sidebar.
  const tenant = await getTenant();
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ClientShell tenant={tenant}>{children}</ClientShell>
      </body>
    </html>
  );
}
