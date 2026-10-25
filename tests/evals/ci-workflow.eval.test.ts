// @vitest-environment node

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const CI_WORKFLOW = new URL("../../.github/workflows/ci.yml", import.meta.url);
const PACKAGE_JSON = new URL("../../package.json", import.meta.url);

function findCommand(job: string, command: string): number {
  const position = job.indexOf(command);

  if (position === -1) {
    throw new Error(`CI command not found: ${command}`);
  }

  return position;
}

describe("CI workflow eval (required threshold: 3/3)", () => {
  it("reruns CI when a draft pull request becomes ready for Factory review", async () => {
    const workflow = await readFile(CI_WORKFLOW, "utf8");
    const pullRequestStart = findCommand(workflow, "\n  pull_request:\n");
    const pushStart = findCommand(workflow, "\n  push:\n");

    expect(workflow.slice(pullRequestStart, pushStart)).toContain(
      "ready_for_review",
    );
  });

  it("keeps Storybook verification as tests followed by a static build", async () => {
    const packageJson = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["eval:storybook"]).toBe(
      "pnpm test:storybook && pnpm storybook:build",
    );
  });

  it("runs Storybook after either Chromium setup path and before Playwright E2E", async () => {
    const workflow = await readFile(CI_WORKFLOW, "utf8");
    const endToEndJobStart = workflow.indexOf("\n  e2e:\n");

    expect(endToEndJobStart).toBeGreaterThan(-1);

    const endToEndJob = workflow.slice(endToEndJobStart);
    const browserInstall = findCommand(
      endToEndJob,
      "pnpm exec playwright install --with-deps chromium",
    );
    const systemDependencies = findCommand(
      endToEndJob,
      "pnpm exec playwright install-deps chromium",
    );
    const storybook = findCommand(endToEndJob, "pnpm eval:storybook");
    const endToEnd = findCommand(
      endToEndJob,
      "pnpm exec playwright test --project=chromium",
    );

    expect(storybook).toBeGreaterThan(
      Math.max(browserInstall, systemDependencies),
    );
    expect(storybook).toBeLessThan(endToEnd);
  });
});
