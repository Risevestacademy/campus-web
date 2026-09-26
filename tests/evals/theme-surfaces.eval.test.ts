// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type Declarations = Map<string, string>;

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const stylesheetPath = path.join(projectRoot, "app/globals.css");
const stylesheet = await readFile(stylesheetPath, "utf8");

const ownedSemanticProperties = [
  "--color-background",
  "--color-foreground",
  "--color-primary",
  "--color-primary-foreground",
  "--color-secondary",
  "--color-secondary-foreground",
  "--color-accent",
  "--color-accent-foreground",
  "--color-border",
] as const;

const compatibilityAliases = new Map([
  ["--background", "var(--color-background)"],
  ["--foreground", "var(--color-foreground)"],
  ["--primary", "var(--color-primary)"],
  ["--primary-foreground", "var(--color-primary-foreground)"],
  ["--secondary", "var(--color-secondary)"],
  ["--secondary-foreground", "var(--color-secondary-foreground)"],
  ["--accent", "var(--color-accent)"],
  ["--accent-foreground", "var(--color-accent-foreground)"],
  ["--border", "var(--color-border)"],
  ["--muted-foreground", "var(--color-foreground-muted)"],
  ["--destructive", "var(--color-error-foreground)"],
]);

function extractBlocks(source: string, header: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const headerIndex = source.indexOf(header, cursor);
    if (headerIndex === -1) break;

    let openingBrace = headerIndex + header.length;
    while (/\s/.test(source[openingBrace] ?? "")) openingBrace += 1;

    if (source[openingBrace] !== "{") {
      cursor = headerIndex + header.length;
      continue;
    }

    let depth = 1;
    let index = openingBrace + 1;
    for (; index < source.length && depth > 0; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
    }

    if (depth !== 0) {
      throw new Error(`Unclosed CSS block for ${header}`);
    }

    blocks.push(source.slice(openingBrace + 1, index - 1));
    cursor = index;
  }

  return blocks;
}

function parseDeclarations(blocks: readonly string[]): Declarations {
  const declarations: Declarations = new Map();
  const customProperty = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;

  for (const block of blocks) {
    for (const match of block.matchAll(customProperty)) {
      declarations.set(match[1]!, match[2]!.trim());
    }
  }

  return declarations;
}

function resolveColor(
  property: string,
  declarations: Declarations,
  visited = new Set<string>(),
): string {
  if (visited.has(property)) {
    throw new Error(`Circular custom property reference at ${property}`);
  }

  const value = declarations.get(property);
  if (!value) throw new Error(`Missing custom property ${property}`);

  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (!reference) return value;

  visited.add(property);
  return resolveColor(reference[1]!, declarations, visited);
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const linearChannels = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return (
    0.2126 * linearChannels[0]! +
    0.7152 * linearChannels[1]! +
    0.0722 * linearChannels[2]!
  );
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

const staticDeclarations = parseDeclarations(
  extractBlocks(stylesheet, "@theme static"),
);
const inlineDeclarations = parseDeclarations(
  extractBlocks(stylesheet, "@theme inline"),
);
const rootDeclarations = parseDeclarations(extractBlocks(stylesheet, ":root"));
const darkDeclarations = parseDeclarations(
  extractBlocks(stylesheet, '[data-theme="dark"]'),
);

function surfacePalette(theme: "light" | "dark") {
  const declarations = new Map(staticDeclarations);
  if (theme === "dark") {
    for (const [property, value] of darkDeclarations) {
      declarations.set(property, value);
    }
  }

  return {
    background: resolveColor("--color-background", declarations),
    surface: resolveColor("--color-surface", declarations),
    elevated: resolveColor("--color-surface-elevated", declarations),
  };
}

describe("theme surface eval", () => {
  it("keeps project semantics as the single owner of overlapping tokens", () => {
    for (const property of ownedSemanticProperties) {
      expect(inlineDeclarations.has(property), property).toBe(false);
    }

    for (const [property, alias] of compatibilityAliases) {
      expect(rootDeclarations.get(property), property).toBe(alias);
    }

    expect(
      [...staticDeclarations, ...darkDeclarations].filter(([property]) =>
        property.startsWith("--color-campus-"),
      ),
    ).toEqual([]);
    expect(extractBlocks(stylesheet, ".dark")).toHaveLength(0);
  });

  it("resolves the approved light and dark surface palettes", () => {
    expect(surfacePalette("light")).toEqual({
      background: "#f7f7f7",
      surface: "#f0f0f0",
      elevated: "#f5f6fa",
    });
    expect(surfacePalette("dark")).toEqual({
      background: "#252525",
      surface: "#333333",
      elevated: "#454545",
    });
  });

  it.each(["light", "dark"] as const)(
    "%s theme clears the 1.05 adjacent-surface contrast gate",
    (theme) => {
      const palette = surfacePalette(theme);

      expect(
        contrastRatio(palette.background, palette.surface),
      ).toBeGreaterThanOrEqual(1.05);
      expect(
        contrastRatio(palette.surface, palette.elevated),
      ).toBeGreaterThanOrEqual(1.05);
    },
  );
});
