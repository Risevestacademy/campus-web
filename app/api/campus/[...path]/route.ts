import { readCampusApiBaseUrl } from "@/core/api/campus/configuration";
import { createCampusApiProxy } from "@/core/api/campus/proxy";
import { createJsonLogger } from "@/core/observability";

const handleCampusApiRequest = createCampusApiProxy({
  baseUrl: readCampusApiBaseUrl,
  logger: createJsonLogger(),
});

export {
  handleCampusApiRequest as DELETE,
  handleCampusApiRequest as GET,
  handleCampusApiRequest as HEAD,
  handleCampusApiRequest as OPTIONS,
  handleCampusApiRequest as PATCH,
  handleCampusApiRequest as POST,
  handleCampusApiRequest as PUT,
};
