import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A value imported from a client module ("use client") into a server module
 * is not the value. The framework hands the server a stand-in that can only
 * be used as a component: spread onto an element it adds nothing, called as a
 * function it throws, and none of it shows in a unit test, where no such
 * swap happens. (A late line on the tap page lost its data-needs-script this
 * way while this design was being built.)
 *
 * So: from a client module, a server module may import components and types,
 * nothing else. Plain values live in modules that are neither, such as
 * @/components/shared. This reads every import in src and checks it.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "test-support" ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) ? [path] : [];
  });
}

const isClientModule = (source: string) =>
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["']/.test(source);

/** The file an import points at, when it is one of ours. */
function target(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

/** A component's name: starts with a capital and is not an ALL_CAPS constant. */
const looksLikeComponent = (name: string) => /^[A-Z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name);

interface Finding {
  file: string;
  from: string;
  name: string;
}

function valueImportsFromClientModules(): {
  findings: Finding[];
  checked: number;
  clientModules: string[];
} {
  const files = sourceFiles(SRC);
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const clientModules = files.filter((file) => isClientModule(sources.get(file)!));
  const findings: Finding[] = [];
  let checked = 0;
  for (const file of files) {
    const source = sources.get(file)!;
    if (isClientModule(source)) continue; // client to client: real values
    const statements = source.matchAll(
      /(import|export)\s+(type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g,
    );
    for (const [, , typeOnly, defaultName, named, specifier] of statements) {
      const to = target(file, specifier!);
      if (!to || !clientModules.includes(to) || typeOnly) continue;
      const names = [
        ...(defaultName ? [defaultName] : []),
        ...(named ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part && !part.startsWith("type "))
          .map((part) => part.split(/\s+as\s+/)[0]!.trim()),
      ];
      for (const name of names) {
        checked++;
        if (!looksLikeComponent(name)) {
          findings.push({ file: file.slice(SRC.length + 1), from: specifier!, name });
        }
      }
    }
  }
  return {
    findings,
    checked,
    clientModules: clientModules.map((file) => file.slice(SRC.length + 1)),
  };
}

describe("the line between server and client modules", () => {
  const { findings, checked, clientModules } = valueImportsFromClientModules();

  it("finds the client modules and the imports that cross into them", () => {
    // If these stop being found, the check below is checking nothing.
    expect(clientModules).toContain("components/consumer.tsx");
    expect(clientModules).toContain("components/stars.tsx");
    expect(clientModules).not.toContain("components/shared.ts");
    expect(clientModules).not.toContain("components/rating-summary.tsx");
    expect(checked).toBeGreaterThan(20);
  });

  it("no server module takes a plain value from a client module", () => {
    expect(findings).toEqual([]);
  });

  it("the values both sides need live in a module that is neither", () => {
    const shared = readFileSync(join(SRC, "components/shared.ts"), "utf8");
    expect(isClientModule(shared)).toBe(false);
    expect(shared).not.toContain("server-only");
    for (const name of ["NEEDS_SCRIPT", "PRIMARY_BUTTON", "SECONDARY_BUTTON"]) {
      expect(shared).toContain(`export const ${name}`);
    }
  });

  it("tells a component's name from a constant's", () => {
    for (const name of ["Row", "ConsumerPage", "Stars", "HeroImage"]) {
      expect(looksLikeComponent(name), name).toBe(true);
    }
    for (const name of ["NEEDS_SCRIPT", "PRIMARY_BUTTON", "starFill", "COPY", "X"]) {
      expect(looksLikeComponent(name), name).toBe(false);
    }
  });
});
