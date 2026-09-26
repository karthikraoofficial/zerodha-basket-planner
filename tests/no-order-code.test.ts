import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// This app is read-only (spec §1). Any order-capable code or the Kite SDK anywhere in the
// shipped source is a failure. Test files are exempt: they must name forbidden calls to
// prove they are refused.
const ROOT = join(import.meta.dirname, "..");
const SCANNED_DIRS = ["app", "lib", "components", "scripts", ".github"];
const SCANNED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|ya?ml)$/;

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "order placement", pattern: /place_?orders?/i },
  { name: "order modification", pattern: /modify_?orders?/i },
  { name: "order cancellation", pattern: /cancel_?orders?/i },
  { name: "order exit", pattern: /exit_?orders?/i },
  { name: "orders endpoint", pattern: /\/orders\b/i },
  { name: "GTT", pattern: /\bgtts?\b|place_?gtt|\/gtt/i },
  { name: "basket orders", pattern: /basket_?orders?|\/baskets?\b/i },
  { name: "Kite SDK import", pattern: /(from\s+|require\(\s*|import\(\s*)["']kiteconnect["']/ },
];

function sourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!SCANNED_EXT.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
    return [path];
  });
}

describe("no order code", () => {
  it("scans a non-empty set of source files", () => {
    const files = SCANNED_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(0);
  });

  it("finds no order-placement code in shipped source", () => {
    const violations = SCANNED_DIRS.flatMap((d) => sourceFiles(join(ROOT, d))).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(
        ({ name }) => `${relative(ROOT, file)}: ${name}`,
      );
    });
    expect(violations).toEqual([]);
  });

  it("does not depend on the kiteconnect SDK", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    expect(Object.keys(deps)).not.toContain("kiteconnect");
  });
});

describe("Kite allow-list", () => {
  it("contains no order, GTT or basket endpoints", async () => {
    const { ALLOWED_KITE_CALLS } = await import("../lib/kite/endpoints");
    const risky = ALLOWED_KITE_CALLS.filter(({ path }) => /order|gtt|basket|alert|mf\//i.test(path));
    expect(risky).toEqual([]);
    expect(ALLOWED_KITE_CALLS.filter(({ method }) => method !== "GET").map((c) => c.path)).toEqual([
      "/session/token",
      "/session/token",
    ]);
  });
});
