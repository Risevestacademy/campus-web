// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  boundaryErrors as lintBoundaries,
  PROJECT_ROOT,
} from "@/tests/fixtures/boundary-lint";

const ROOT_LAYOUT = path.join(PROJECT_ROOT, "app/layout.tsx");

function boundaryErrors(source: string): Promise<string[]> {
  return lintBoundaries(source, ROOT_LAYOUT);
}

function layoutImporting(specifier: string): string {
  return `import { shellInitializerScript } from "${specifier}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script>{shellInitializerScript}</script>
        {children}
      </body>
    </html>
  );
}
`;
}

describe("Root layout entry boundary eval (threshold: every case holds)", () => {
  it("accepts the shipped root layout", async () => {
    const source = await readFile(ROOT_LAYOUT, "utf8");

    await expect(boundaryErrors(source)).resolves.toEqual([]);
  });

  it("accepts the campus feature's document entry", async () => {
    await expect(
      boundaryErrors(layoutImporting("@/features/campus/document")),
    ).resolves.toEqual([]);
  });

  it.each([
    [
      "the campus barrel, which ships every campus client module on every page",
      "@/features/campus",
    ],
    ["a campus internal", "@/features/campus/store/shell-preferences"],
  ])("rejects %s", async (_, specifier) => {
    await expect(
      boundaryErrors(layoutImporting(specifier)),
    ).resolves.not.toEqual([]);
  });
}, 60_000);
