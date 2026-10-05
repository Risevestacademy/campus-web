import path from "node:path";

import { ESLint } from "eslint";

export const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

// Lints with the project's real ESLint config, so file categories in
// config/architecture-boundaries.json apply to `filePath`.
export async function boundaryErrors(
  source: string,
  filePath: string,
): Promise<string[]> {
  const eslint = new ESLint({ cwd: PROJECT_ROOT });
  const [result] = await eslint.lintText(source, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "boundaries/dependencies")
    .map((message) => message.message);
}
