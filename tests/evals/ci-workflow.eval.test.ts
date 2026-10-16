// @vitest-environment node

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const CI_WORKFLOW = new URL("../../.github/workflows/ci.yml", import.meta.url);
const PACKAGE_JSON = new URL("../../package.json", import.meta.url);

function extractJob(workflow: string, jobName: string): string {
  const lines = workflow.split("\n");
  const jobStart = lines.findIndex((line) => line === `  ${jobName}:`);

  if (jobStart === -1) {
    throw new Error(`CI job not found: ${jobName}`);
  }

  const jobEnd = lines.findIndex(
    (line, index) => index > jobStart && /^  [a-zA-Z0-9_-]+:$/.test(line),
  );

  return lines.slice(jobStart, jobEnd === -1 ? undefined : jobEnd).join("\n");
}

function findNamedStepLine(job: string, stepName: string): number {
  const stepLine = job
    .split("\n")
    .findIndex((line) => line.trim() === `- name: ${stepName}`);

  if (stepLine === -1) {
    throw new Error(`CI step not found: ${stepName}`);
  }

  return stepLine;
}

function extractNamedStep(job: string, stepName: string): string {
  const lines = job.split("\n");
  const stepStart = findNamedStepLine(job, stepName);
  const stepEnd = lines.findIndex(
    (line, index) => index > stepStart && /^      - (?:name|uses):/.test(line),
  );

  return lines
    .slice(stepStart, stepEnd === -1 ? undefined : stepEnd)
    .join("\n");
}

describe("CI workflow eval (required threshold: 3/3)", () => {
  it("keeps Storybook verification fail-fast and free of CI-only wrappers", async () => {
    const packageJson = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["eval:storybook"]).toBe(
      "pnpm test:storybook && pnpm storybook:build",
    );
  });

  it("runs the existing Storybook verification contract in the e2e job", async () => {
    const workflow = await readFile(CI_WORKFLOW, "utf8");
    const storybookStep = extractNamedStep(
      extractJob(workflow, "e2e"),
      "Storybook tests and build",
    );

    expect(storybookStep.split("\n").map((line) => line.trim())).toContain(
      "run: pnpm eval:storybook",
    );
  });

  it("runs Storybook verification after Chromium setup and before E2E", async () => {
    const workflow = await readFile(CI_WORKFLOW, "utf8");
    const endToEndJob = extractJob(workflow, "e2e");
    const browserInstall = findNamedStepLine(
      endToEndJob,
      "Install Playwright browsers",
    );
    const systemDependencies = findNamedStepLine(
      endToEndJob,
      "Install system deps (cache hit path)",
    );
    const storybook = findNamedStepLine(
      endToEndJob,
      "Storybook tests and build",
    );
    const endToEnd = findNamedStepLine(endToEndJob, "E2E");

    expect(storybook).toBeGreaterThan(
      Math.max(browserInstall, systemDependencies),
    );
    expect(storybook).toBeLessThan(endToEnd);
  });
});
