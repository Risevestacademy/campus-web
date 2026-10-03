// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROOT_PROXY = path.join(PROJECT_ROOT, "proxy.ts");
const BOUNDARY_RULE = "boundaries/dependencies";

async function boundaryErrors(source: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: PROJECT_ROOT });
  const [result] = await eslint.lintText(source, { filePath: ROOT_PROXY });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === BOUNDARY_RULE)
    .map((message) => message.message);
}

function proxyImporting(specifier: string): string {
  return `import type { NextRequest } from "next/server";

import { guardCampusRequest } from "${specifier}";

export function proxy(request: NextRequest) {
  return guardCampusRequest(request);
}

export const config = {
  matcher: ["/campus/:path*"],
};
`;
}

describe("Root proxy entry boundary eval (threshold: every case holds)", () => {
  it("accepts the shipped root proxy", async () => {
    const source = await readFile(ROOT_PROXY, "utf8");

    await expect(boundaryErrors(source)).resolves.toEqual([]);
  });

  it("accepts the auth feature's proxy entry", async () => {
    await expect(
      boundaryErrors(proxyImporting("@/features/auth/proxy")),
    ).resolves.toEqual([]);
  });

  it.each([
    [
      "the auth barrel, which pulls client and server-only code",
      "@/features/auth",
    ],
    ["an auth internal", "@/features/auth/services/campus-proxy.service"],
  ])("rejects %s", async (_, specifier) => {
    await expect(
      boundaryErrors(proxyImporting(specifier)),
    ).resolves.not.toEqual([]);
  });
}, 60_000);
