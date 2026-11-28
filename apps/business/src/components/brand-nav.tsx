"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The brand app's sections. A section listed here must be in BRAND_PREFIXES. */
export const BRAND_SECTIONS = [
  { href: "/home", label: "Home", managersOnly: false },
  { href: "/products", label: "Products", managersOnly: false },
  { href: "/sales", label: "Sales", managersOnly: false },
  { href: "/team", label: "Team", managersOnly: true },
] as const;

export function BrandNav({ manager = false }: { manager?: boolean }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className="-mb-px flex gap-6">
      {BRAND_SECTIONS.filter((section) => manager || !section.managersOnly).map((section) => {
        const current = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <li key={section.href}>
            <Link
              href={section.href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex h-11 items-center border-b-2 text-sm ${
                current
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {section.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
