import { writeFile } from "node:fs/promises";

import openapiTS, { astToString } from "openapi-typescript";

import { readCampusOpenApiUrl } from "./configuration.ts";

const schema = await openapiTS(readCampusOpenApiUrl());
const outputUrl = new URL("./generated/schema.ts", import.meta.url);

await writeFile(outputUrl, astToString(schema));
