// railway/iac version-checks the CLI found at the shell's `$_`. Under
// `pnpm run` that names this script's launcher instead of railway, and the
// check fails. Without `_` the SDK falls back to `railway` on PATH.
export function railwayCliEnvironment<
  Environment extends Record<string, string | undefined>,
>(environment: Environment): Environment {
  const cliEnvironment = { ...environment };
  Reflect.deleteProperty(cliEnvironment, "_");

  return cliEnvironment;
}
