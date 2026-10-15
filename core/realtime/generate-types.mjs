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

const schemaUrl = readWorldSchemaUrl();
const response = await fetch(schemaUrl);

if (!response.ok) {
  throw new Error(`${schemaUrl} answered HTTP ${response.status}.`);
}

const { title, description, definitions } = JSON.parse(
  await response.text(),
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

await writeFile(outputUrl, astToString(schema));
