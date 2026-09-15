import { writeFile } from "node:fs/promises";

import openapiTS, { astToString } from "openapi-typescript";

import { readOpenApiUrl } from "./configuration.ts";

const schema = await openapiTS(readOpenApiUrl());
const outputUrl = new URL("./generated/schema.ts", import.meta.url);

await writeFile(outputUrl, astToString(schema));
