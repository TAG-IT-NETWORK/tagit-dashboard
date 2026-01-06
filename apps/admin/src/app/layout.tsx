import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import "./globals.css";

// Dynamic import with SSR disabled for the entire client shell (providers + admin shell)
// This prevents wagmi hooks from running during server-side rendering
const ClientShell = dynamic(
  () => import("./client-shell").then((mod) => mod.ClientShell),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    ),
  }
);

const inter = Inter({ subsets: ["latin"] });

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
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
