import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { railwayCliEnvironment } from "./railway-cli-environment.ts";
import {
  evaluateWakeGate,
  formatBaselineRow,
  needsWakeRetry,
  type Probe,
  summarizeWarm,
} from "./wake-gate.ts";

const ENVIRONMENT = "staging";
const SLEEP_POLL_SECONDS = 60;
const SLEEP_WAIT_MINUTES = 20;
const PROBE_TIMEOUT_SECONDS = 30;
const WARM_SAMPLE_SIZE = 5;

type FrontendTarget = {
  service: string;
  url: string;
  apiHealthPath?: string;
};

const targets: Record<string, FrontendTarget> = {
  web: {
    service: "campus-web",
    url: process.env.CAMPUS_WEB_URL ?? "https://dev.campusbyrise.com",
    apiHealthPath: "/api/v1/health",
  },
  storybook: {
    service: "campus-storybook",
    url:
      process.env.CAMPUS_STORYBOOK_URL ??
      "https://storybook.dev.campusbyrise.com",
  },
};

const evidenceDirectory = path.join(
  os.tmpdir(),
  "campus-railway-evidence",
  ENVIRONMENT,
);
const pinnedPlanPath = path.join(evidenceDirectory, "staging-plan.json");

function print(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function heading(title: string): void {
  print();
  print(`== ${title}`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

function railway(commandArguments: readonly string[]): number {
  print(`$ railway ${commandArguments.join(" ")}`);
  const result = spawnSync("railway", commandArguments, {
    env: railwayCliEnvironment(process.env),
    stdio: "inherit",
  });

  return result.status ?? 1;
}

function railwayOutput(commandArguments: readonly string[]): string {
  const result = spawnSync("railway", commandArguments, {
    encoding: "utf8",
    env: railwayCliEnvironment(process.env),
  });

  if (result.status !== 0) {
    throw new Error(
      `railway ${commandArguments.join(" ")} failed: ${result.stderr}`,
    );
  }

  return result.stdout;
}

function saveEvidence(name: string, contents: string): string {
  mkdirSync(evidenceDirectory, { recursive: true });
  const filePath = path.join(evidenceDirectory, name);
  writeFileSync(filePath, contents);

  return filePath;
}

async function confirmLinkedToStaging(): Promise<void> {
  railway(["status"]);
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    `Type "${ENVIRONMENT}" if the linked environment above is ${ENVIRONMENT}: `,
  );
  prompt.close();

  if (answer.trim() !== ENVIRONMENT) {
    throw new Error(
      `Stopped: not confirmed as ${ENVIRONMENT}. Run railway link --project campus-by-rise --environment ${ENVIRONMENT}.`,
    );
  }
}

function assertRailwayDirectoryCommitted(): void {
  const result = spawnSync("git", ["status", "--porcelain", ".railway"], {
    encoding: "utf8",
  });

  if (result.stdout.trim()) {
    throw new Error(
      "Commit .railway first: a pinned plan records HEAD:.railway, not the working tree.",
    );
  }
}

function serviceStatus(service: string): string {
  return railwayOutput([
    "service",
    "status",
    "--service",
    service,
    "--environment",
    ENVIRONMENT,
    "--json",
  ]);
}

function isSleeping(service: string): boolean {
  const { status } = JSON.parse(serviceStatus(service)) as { status?: string };

  return status === "SLEEPING";
}

async function probe(url: string): Promise<Probe> {
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_SECONDS * 1000),
    });
    await response.arrayBuffer();

    return {
      status: response.status,
      seconds: (performance.now() - startedAt) / 1000,
    };
  } catch {
    return { status: 0, seconds: (performance.now() - startedAt) / 1000 };
  }
}

function describeProbe({ status, seconds }: Probe): string {
  return `${status} in ${seconds.toFixed(2)}s`;
}

function resolveTarget(name: string | undefined): FrontendTarget {
  const target = name ? targets[name] : undefined;

  if (!target) {
    throw new Error(
      `Unknown target "${name ?? ""}". Use: ${Object.keys(targets).join(", ")}`,
    );
  }

  return target;
}

async function preflight(): Promise<void> {
  heading("Account and link");
  railway(["whoami"]);
  railway(["status"]);
  heading("Environments (look for stale PR or preview environments)");
  railway(["environment", "list"]);
  heading(`Services in ${ENVIRONMENT}`);
  railway(["service", "list", "--environment", ENVIRONMENT]);
  for (const { service } of Object.values(targets)) {
    railway([
      "service",
      "status",
      "--service",
      service,
      "--environment",
      ENVIRONMENT,
    ]);
  }
  heading("Usage and limits");
  railway(["usage"]);
  railway(["usage", "projects"]);
  railway(["usage", "limit", "status"]);
}

function drift(): void {
  heading("Live staging graph (read-only, nothing written to the repo)");
  const filePath = saveEvidence(
    `live-graph-${timestamp()}.json`,
    railwayOutput(["config", "pull", "--json"]),
  );
  print(`Saved ${filePath}`);
  print("Share this file with Claude to compare against .railway/stack.ts.");
}

function memory(label: string | undefined, since: string): void {
  if (!label) {
    throw new Error('Usage: memory <before|after> [since, default "1d"]');
  }

  for (const { service } of Object.values(targets)) {
    heading(`${service} memory, last ${since} (${label})`);
    const metrics = railwayOutput([
      "metrics",
      "--service",
      service,
      "--environment",
      ENVIRONMENT,
      "--memory",
      "--since",
      since,
      "--json",
    ]);
    print(metrics);
    print(
      `Saved ${saveEvidence(`memory-${label}-${service}-${timestamp()}.json`, metrics)}`,
    );
  }
}

async function plan(): Promise<void> {
  assertRailwayDirectoryCommitted();
  await confirmLinkedToStaging();
  mkdirSync(evidenceDirectory, { recursive: true });
  const exitCode = railway([
    "config",
    "plan",
    "--verbose",
    "--detailed-exit-code",
    "--out",
    pinnedPlanPath,
  ]);

  if (exitCode === 0) {
    print("No changes pending. Staging already matches .railway/stack.ts.");
    return;
  }
  if (exitCode !== 2) {
    throw new Error(`railway config plan failed with exit code ${exitCode}`);
  }

  print();
  print(`Pinned plan: ${pinnedPlanPath}`);
  print(
    "Reject it if it touches campus-api, campus-world, databases, volumes, domains, or production.",
  );
  print("Otherwise run: pnpm railway:verify apply");
}

async function apply(): Promise<void> {
  await confirmLinkedToStaging();
  const exitCode = railway(["config", "apply", "--plan", pinnedPlanPath]);

  if (exitCode !== 0) {
    throw new Error(`railway config apply failed with exit code ${exitCode}`);
  }

  print();
  print("Serverless is read when a container is created. Redeploy both:");
  print("  pnpm railway:verify redeploy");
}

function redeploy(): void {
  for (const { service } of Object.values(targets)) {
    const exitCode = railway([
      "redeploy",
      "--service",
      service,
      "--environment",
      ENVIRONMENT,
    ]);

    if (exitCode !== 0) {
      throw new Error(`railway redeploy ${service} failed`);
    }
  }
  print();
  print(
    "Leave staging untouched for 10+ minutes, then: pnpm railway:verify sleep",
  );
}

async function waitForSleep(): Promise<void> {
  const deadline = Date.now() + SLEEP_WAIT_MINUTES * 60 * 1000;
  const pending = new Set(Object.values(targets).map(({ service }) => service));

  while (pending.size > 0 && Date.now() < deadline) {
    for (const service of pending) {
      if (isSleeping(service)) {
        print(`${new Date().toISOString()} ${service} is SLEEPING`);
        pending.delete(service);
      }
    }
    if (pending.size > 0) {
      print(
        `${new Date().toISOString()} awake: ${[...pending].join(", ")}; checking again in ${SLEEP_POLL_SECONDS}s`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, SLEEP_POLL_SECONDS * 1000),
      );
    }
  }

  if (pending.size > 0) {
    throw new Error(
      `Still awake after ${SLEEP_WAIT_MINUTES} minutes: ${[...pending].join(", ")}. Inspect outbound traffic: railway logs --network --service <name> --environment ${ENVIRONMENT} --since 30m`,
    );
  }
  print("Both services are asleep. Next: pnpm railway:verify wake web");
}

async function wake(
  targetName: string | undefined,
  allowAwake: boolean,
): Promise<void> {
  const target = resolveTarget(targetName);

  if (!allowAwake && !isSleeping(target.service)) {
    throw new Error(
      `${target.service} is not SLEEPING, so this would not measure a cold start. Run pnpm railway:verify sleep first, or pass --allow-awake.`,
    );
  }

  heading(`Cold load ${target.url}/`);
  const wakeProbes = [await probe(`${target.url}/`)];
  const [firstProbe] = wakeProbes;
  if (firstProbe && needsWakeRetry(firstProbe)) {
    wakeProbes.push(await probe(`${target.url}/`));
  }
  wakeProbes.forEach((wakeProbe, index) =>
    print(`request ${index + 1}: ${describeProbe(wakeProbe)}`),
  );
  const verdict = evaluateWakeGate(wakeProbes);
  print(`gate: ${verdict.passed ? "PASS" : "FAIL"} (${verdict.reason})`);

  heading(`Warm load x${WARM_SAMPLE_SIZE}`);
  const warmProbes: Probe[] = [];
  for (let sample = 0; sample < WARM_SAMPLE_SIZE; sample += 1) {
    warmProbes.push(await probe(`${target.url}/`));
  }
  const warm = summarizeWarm(warmProbes);
  print(
    `median ${warm.medianSeconds.toFixed(2)}s, max ${warm.maxSeconds.toFixed(2)}s, all 2xx: ${warm.allSucceeded}`,
  );

  let apiHealth: Probe | undefined;
  if (target.apiHealthPath) {
    heading(`Informational: ${target.apiHealthPath} through campus-web`);
    apiHealth = await probe(`${target.url}${target.apiHealthPath}`);
    print(describeProbe(apiHealth));
  }

  heading("Baseline row for .railway/README.md");
  print(
    formatBaselineRow({
      date: today(),
      target: `${targetName} /`,
      wake: wakeProbes,
      verdict,
      warm,
      apiHealth,
    }),
  );

  if (!verdict.passed || !warm.allSucceeded) {
    process.exitCode = 1;
  }
}

function usage(): void {
  print(`Usage: pnpm railway:verify <step>

Steps, in order:
  preflight                 Link, environments, services, usage (read-only)
  drift                     Save the live staging graph as JSON (read-only)
  memory <label> [since]    Save campus-web and campus-storybook memory metrics
  plan                      Pin a staging plan (requires .railway committed)
  apply                     Apply the pinned plan
  redeploy                  Redeploy both services so Serverless takes effect
  sleep                     Wait until both services report SLEEPING
  wake <web|storybook>      Cold-load gate, warm sample, baseline row
       [--allow-awake]

Evidence is written to ${evidenceDirectory}`);
}

async function main(): Promise<void> {
  const [step, ...stepArguments] = process.argv.slice(2);

  switch (step) {
    case "preflight": {
      await preflight();
      break;
    }
    case "drift": {
      drift();
      break;
    }
    case "memory": {
      memory(stepArguments[0], stepArguments[1] ?? "1d");
      break;
    }
    case "plan": {
      await plan();
      break;
    }
    case "apply": {
      await apply();
      break;
    }
    case "redeploy": {
      redeploy();
      break;
    }
    case "sleep": {
      await waitForSleep();
      break;
    }
    case "wake": {
      await wake(stepArguments[0], stepArguments.includes("--allow-awake"));
      break;
    }
    default: {
      usage();
      process.exitCode = step ? 1 : 0;
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
