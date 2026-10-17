import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import openapiTS, { astToString } from "openapi-typescript";

import { readWorldSchemaUrl } from "./configuration.ts";

// world publishes draft-07 JSON Schema; openapi-typescript reads OpenAPI 3.1.
// Its definitions become components.schemas, so their refs must point there.
const DEFINITIONS_REF = /^#\/definitions\//;

function pointAtComponents(key, value) {
  return key === "$ref" && typeof value === "string"
    ? value.replace(DEFINITIONS_REF, "#/components/schemas/")
    : value;
}

const SCHEMA_FETCH_TIMEOUT_MS = 10_000;

const schemaUrl = readWorldSchemaUrl(process.env);
const response = await fetch(schemaUrl, {
  signal: AbortSignal.timeout(SCHEMA_FETCH_TIMEOUT_MS),
});

if (!response.ok) {
  throw new Error(`${schemaUrl} answered HTTP ${response.status}.`);
}

const schemaText = await response.text();
const { title, description, definitions } = JSON.parse(
  schemaText,
  pointAtComponents,
);

const schema = await openapiTS(
  {
    openapi: "3.1.0",
    info: { title, description, version: "world" },
    paths: {},
    components: { schemas: definitions },
  },
  { rootTypes: true, rootTypesNoSchemaPrefix: true },
);
const outputUrl = new URL("./generated/world-protocol.ts", import.meta.url);

// A hash, not the URL: it names the server commit without naming a host.
const schemaHash = createHash("sha256").update(schemaText).digest("hex");
const provenance = [
  `// From world's protocol.schema.json, sha256 ${schemaHash}.`,
  "// Find the campus-server commit: git show <ref>:apps/world/protocol.schema.json | shasum -a 256",
  "",
].join("\n");

await writeFile(outputUrl, `${provenance}\n${astToString(schema)}`);
