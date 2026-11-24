import type { Metadata } from "next";
import { getSessionTenant, getTenantContext } from "@/lib/actor";
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
  // The menu follows who the user IS, never the brand a platform admin is
  // creating for (TAP-T16): that one is shown as a banner instead.
  const tenant = await getSessionTenant();
  const context = await getTenantContext();
  const actingBrand = context.acting ? context.tenant : null;
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ClientShell tenant={tenant} actingBrand={actingBrand}>
          {children}
        </ClientShell>
      </body>
    </html>
  );
}
