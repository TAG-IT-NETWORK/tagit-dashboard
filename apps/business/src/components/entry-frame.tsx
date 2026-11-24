import Image from "next/image";
import type { ReactNode } from "react";

/** The plain frame around the sign-in and no-access pages. */
export function EntryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center border-b px-6 md:px-10">
        <a href="/" className="flex items-center gap-3">
          <Image src="/tagit_logo.png" alt="" width={32} height={32} priority />
          <span className="font-semibold tracking-tight">TAG IT Business</span>
        </a>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6 text-center">{children}</div>
      </main>
    </div>
  );
}
