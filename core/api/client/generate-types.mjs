import { writeFile } from "node:fs/promises";

import openapiTS, { astToString } from "openapi-typescript";

import { readOpenApiUrl } from "./configuration.ts";

const SCHEMA_FETCH_TIMEOUT_MS = 10_000;

// Fetched here, not by openapiTS(url), which offers no timeout.
const schemaUrl = readOpenApiUrl();
const response = await fetch(schemaUrl, {
  signal: AbortSignal.timeout(SCHEMA_FETCH_TIMEOUT_MS),
});

if (!response.ok) {
  throw new Error(`${schemaUrl} answered HTTP ${response.status}.`);
}

const schema = await openapiTS(await response.json());
const outputUrl = new URL("./generated/schema.ts", import.meta.url);

await writeFile(outputUrl, astToString(schema));
